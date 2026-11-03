"""Budget rules: shares, balance per currency, one-gesture settlement. No bank link."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Sum

from accounts.models import User
from couples.models import Couple

from .models import Expense, ExpenseShare, Settlement, Split


def equal_shares(amount: int) -> tuple[int, int]:
    """(payer, other) for a 50/50 split; an odd unit stays with the payer."""
    other = amount // 2
    return amount - other, other


@transaction.atomic
def set_shares(expense: Expense, couple: Couple, requester: User, my_share: int | None) -> None:
    """Writes both shares. `my_share` (the requester's part) is used for custom splits only."""
    partner = couple.partner_of(requester)
    if expense.split == Split.EQUAL:
        payer_part, other_part = equal_shares(expense.amount)
        payer = expense.paid_by or requester
        mine = payer_part if payer.pk == requester.pk else other_part
    else:
        mine = my_share if my_share is not None else 0
    rows = {requester: mine}
    if partner is not None:
        rows[partner] = expense.amount - mine
    expense.shares.exclude(user__in=list(rows)).delete()
    for user, amount in rows.items():
        ExpenseShare.objects.update_or_create(
            expense=expense, user=user, defaults={"amount": amount}
        )


@dataclass(frozen=True)
class Balance:
    currency: str
    #: Positive: the partner owes me. Negative: I owe the partner.
    net: int


def balances(couple: Couple, me: User) -> list[Balance]:
    partner = couple.partner_of(me)
    if partner is None:
        return []
    net: dict[str, int] = defaultdict(int)

    def add(rows: object, sign: int, key: str) -> None:
        for row in rows:  # type: ignore[attr-defined]
            net[row[key]] += sign * (row["total"] or 0)

    shares = ExpenseShare.objects.filter(expense__couple=couple)
    add(
        shares.filter(expense__paid_by=me, user=partner)
        .values("expense__currency")
        .annotate(total=Sum("amount")),
        +1,
        "expense__currency",
    )
    add(
        shares.filter(expense__paid_by=partner, user=me)
        .values("expense__currency")
        .annotate(total=Sum("amount")),
        -1,
        "expense__currency",
    )
    settlements = Settlement.objects.filter(couple=couple)
    add(
        settlements.filter(from_user=partner, to_user=me)
        .values("currency")
        .annotate(total=Sum("amount")),
        -1,
        "currency",
    )
    add(
        settlements.filter(from_user=me, to_user=partner)
        .values("currency")
        .annotate(total=Sum("amount")),
        +1,
        "currency",
    )
    return [Balance(currency, value) for currency, value in sorted(net.items())]


@transaction.atomic
def settle(couple: Couple, me: User, currency: str) -> Settlement | None:
    """Records the reimbursement that brings this currency's balance back to zero."""
    partner = couple.partner_of(me)
    current = next((b.net for b in balances(couple, me) if b.currency == currency), 0)
    if partner is None or current == 0:
        return None
    debtor, creditor = (partner, me) if current > 0 else (me, partner)
    return Settlement.objects.create(
        couple=couple, from_user=debtor, to_user=creditor, amount=abs(current), currency=currency
    )
