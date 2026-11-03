from typing import Any, cast

from django.db.models import Model
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from core.auth import current_user
from core.pagination import DefaultCursorPagination
from memories.services import local_today

from . import budget
from .models import Expense
from .serializers import BalanceSerializer, ExpenseSerializer, SettleSerializer
from .views import CoupleContextMixin


class ExpensePagination(DefaultCursorPagination):
    ordering = ("-spent_on", "-id")


class ExpenseViewSet(CoupleContextMixin, viewsets.ModelViewSet[Expense]):
    """Shared expenses, the simple balance and the one-gesture reimbursement."""

    queryset = Expense.objects.select_related("paid_by").prefetch_related("shares")
    serializer_class = ExpenseSerializer
    pagination_class = ExpensePagination
    author_field = "created_by"

    def _save(self, serializer: BaseSerializer[Model], **extra: Any) -> None:
        data = serializer.validated_data
        my_share = data.pop("my_share", None)
        user = current_user(self.request)
        defaults: dict[str, Any] = {}
        if serializer.instance is None:
            defaults = {
                "currency": data.get("currency") or self.couple.currency,
                "spent_on": data.get("spent_on") or local_today(user.timezone),
                "paid_by": data.get("paid_by") or user,
            }
        expense = cast(Expense, serializer.save(**defaults, **extra))
        budget.set_shares(expense, self.couple, user, my_share)

    def perform_create(self, serializer: BaseSerializer[Model]) -> None:
        self._save(serializer, **self.scoped_save_kwargs())

    def perform_update(self, serializer: BaseSerializer[Model]) -> None:
        self._save(serializer)

    def _balance_payload(self) -> list[dict[str, Any]]:
        rows = []
        for item in budget.balances(self.couple, current_user(self.request)):
            direction = (
                "partner_owes_me"
                if item.net > 0
                else "i_owe_partner"
                if item.net < 0
                else "settled"
            )
            rows.append(
                {"currency": item.currency, "amount": abs(item.net), "direction": direction}
            )
        return rows

    @extend_schema(responses={200: BalanceSerializer(many=True)})
    @action(detail=False, methods=["get"])
    def balance(self, request: Request) -> Response:
        """Who owes how much, per currency. Simple and neutral."""
        return Response(BalanceSerializer(self._balance_payload(), many=True).data)

    @extend_schema(request=SettleSerializer, responses={200: BalanceSerializer(many=True)})
    @action(detail=False, methods=["post"])
    def settle(self, request: Request) -> Response:
        """Records the reimbursement of the whole balance in this currency."""
        payload = SettleSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        budget.settle(self.couple, current_user(request), payload.validated_data["currency"])
        return Response(BalanceSerializer(self._balance_payload(), many=True).data)
