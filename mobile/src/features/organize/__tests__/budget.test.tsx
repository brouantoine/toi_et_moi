import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { registerOfflineMutations } from '@/api/offline';
import { coupleKey } from '@/features/couple/useCouple';
import { meKey } from '@/features/me/useProfile';
import i18n from '@/i18n';
import {
  createTestQueryClient,
  jsonResponse,
  mockFetch,
  renderWithProviders,
  routerMock,
} from '@/test-utils';

import { expensePayload, emptyExpenseForm } from '../budget/expenseForm';
import { ExpenseFormScreen } from '../budget/ExpenseFormScreen';
import { formatMoney, parseAmount } from '../budget/money';
import { OrganizeScreen } from '../OrganizeScreen';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));

const me = { id: 1, display_name: 'Léa' };
const couple = {
  id: 3,
  status: 'active',
  currency: 'EUR',
  members: [
    { id: 1, display_name: 'Léa' },
    { id: 2, display_name: 'Sam' },
  ],
};
const expense = {
  id: 4,
  title: 'Courses du samedi',
  amount: 4250,
  currency: 'EUR',
  category: 'groceries',
  spent_on: '2026-11-07',
  paid_by: 'you',
  split: 'equal',
  my_share: 2125,
  partner_share: 2125,
  created_at: '',
};

type Call = { method: string; path: string; body?: unknown };

function backend({
  expenses = [expense],
  balance = [{ currency: 'EUR', amount: 2125, direction: 'i_owe_partner' }],
} = {}) {
  const calls: Call[] = [];
  mockFetch().mockImplementation(async (arg) => {
    const request = arg as Request;
    const { pathname } = new URL(request.url);
    const text = ['POST', 'PATCH'].includes(request.method) ? await request.clone().text() : '';
    calls.push({
      method: request.method,
      path: pathname,
      body: text ? JSON.parse(text) : undefined,
    });
    if (pathname === '/api/v1/me/') return jsonResponse(me);
    if (pathname === '/api/v1/couple/') return jsonResponse(couple);
    if (pathname.endsWith('/occurrences/')) return jsonResponse([]);
    if (pathname === '/api/v1/expenses/balance/') return jsonResponse(balance);
    if (pathname === '/api/v1/expenses/settle/')
      return jsonResponse([{ currency: 'EUR', amount: 0, direction: 'settled' }]);
    if (pathname === '/api/v1/expenses/' && request.method === 'GET')
      return jsonResponse({ next: null, previous: null, results: expenses });
    if (request.method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse(expense, request.method === 'POST' ? 201 : 200);
  });
  return calls;
}

function render(ui: React.ReactElement) {
  const client = createTestQueryClient();
  registerOfflineMutations(client);
  client.setQueryData(meKey, me);
  client.setQueryData(coupleKey, couple);
  return renderWithProviders(ui, 'light', client);
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');
const nbsp = (s: string) => s.replace(/[  ]/g, ' ');

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

describe('money', () => {
  it.each([
    ['12,50', 'EUR', 1250],
    ['12.5', 'EUR', 1250],
    ['1 250', 'EUR', 125000],
    ['5000', 'XOF', 5000],
    ['0', 'EUR', null],
    ['12,505', 'EUR', null],
    ['douze', 'EUR', null],
    ['5,5', 'XOF', null],
  ])('parseAmount(%s, %s) = %s', (text, currency, expected) => {
    expect(parseAmount(text, currency)).toBe(expected);
  });

  it('formats in the locale', () => {
    expect(nbsp(formatMoney(4250, 'EUR', 'fr'))).toBe('42,50 €');
    expect(nbsp(formatMoney(5000, 'XOF', 'fr'))).toBe('5 000 F CFA');
  });

  it('builds the API body', () => {
    const base = { ...emptyExpenseForm(new Date(2026, 10, 7)), title: ' Resto ', amount: '60' };
    expect(expensePayload(base, 'EUR')).toEqual({
      title: 'Resto',
      amount: 6000,
      currency: 'EUR',
      category: 'groceries',
      paid_by: 'me',
      split: 'equal',
      spent_on: '2026-11-07',
    });
    expect(expensePayload({ ...base, split: 'custom', myShare: '20' }, 'EUR')).toMatchObject({
      split: 'custom',
      my_share: 2000,
    });
  });
});

describe('Budget section', () => {
  it('shows the balance in plain words, the expenses, and settles after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const calls = backend();
    await render(<OrganizeScreen />);
    await fireEvent.press(screen.getByTestId('organize-section-budget'));
    expect(await screen.findByText('Courses du samedi')).toBeTruthy();
    expect(screen.getByText(/^Tu dois 21,25\s€ à Sam$/)).toBeTruthy();
    expect(screen.getByText(/^Ta part 21,25\s€$/)).toBeTruthy();
    expect(screen.getByText(/Payé par Sam/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('settle-EUR'));
    (alert.mock.calls[0]?.[2] as AlertButton[]).find((b) => b.style !== 'cancel')?.onPress?.();
    await waitFor(() =>
      expect(writes(calls)[0]).toEqual({
        method: 'POST',
        path: '/api/v1/expenses/settle/',
        body: { currency: 'EUR' },
      }),
    );

    await fireEvent.press(screen.getByTestId('expense-4'));
    expect(routerMock().push).toHaveBeenCalledWith('/organize/expense/4');
  });

  it('has a kind empty state and no balance card when nothing is shared', async () => {
    backend({ expenses: [], balance: [] });
    await render(<OrganizeScreen />);
    await fireEvent.press(screen.getByTestId('organize-section-budget'));
    expect(await screen.findByTestId('budget-empty')).toBeTruthy();
    expect(screen.queryByTestId('balance-EUR')).toBeNull();
  });
});

describe('Expense form', () => {
  it('validates the amount and the custom share', async () => {
    const calls = backend();
    await render(<ExpenseFormScreen />);
    await fireEvent.changeText(await screen.findByTestId('expense-form-title'), 'Resto');
    await fireEvent.changeText(screen.getByTestId('expense-form-amount'), 'douze');
    await fireEvent.press(screen.getByTestId('expense-form-save'));
    expect(await screen.findByText('Indique un montant, par exemple 12,50.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('expense-form-amount'), '60');
    await fireEvent.press(screen.getByTestId('expense-form-split-custom'));
    await fireEvent.changeText(screen.getByTestId('expense-form-my-share'), '80');
    await fireEvent.press(screen.getByTestId('expense-form-save'));
    expect(await screen.findByText('Ta part doit être entre 0 et le montant.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
  });

  it('adds an expense paid by the partner with a custom split', async () => {
    const calls = backend();
    await render(<ExpenseFormScreen />);
    await fireEvent.changeText(await screen.findByTestId('expense-form-title'), 'Billets de train');
    await fireEvent.changeText(screen.getByTestId('expense-form-amount'), '120,00');
    await fireEvent.press(screen.getByTestId('expense-form-category-travel'));
    await fireEvent.press(screen.getByTestId('expense-form-paid-you'));
    await fireEvent.press(screen.getByTestId('expense-form-split-custom'));
    await fireEvent.changeText(screen.getByTestId('expense-form-my-share'), '40');
    await fireEvent.press(screen.getByTestId('expense-form-save'));
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/expenses/',
      body: {
        title: 'Billets de train',
        amount: 12000,
        currency: 'EUR',
        category: 'travel',
        paid_by: 'you',
        split: 'custom',
        my_share: 4000,
      },
    });
  });

  it('edits and deletes an expense', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const calls = backend();
    await render(<ExpenseFormScreen expenseId={4} />);
    expect(await screen.findByDisplayValue('42,50')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('expense-form-amount'), '45');
    await fireEvent.press(screen.getByTestId('expense-form-save'));
    await waitFor(() =>
      expect(writes(calls)[0]).toMatchObject({
        method: 'PATCH',
        path: '/api/v1/expenses/4/',
        body: { amount: 4500 },
      }),
    );
    await fireEvent.press(screen.getByTestId('expense-form-delete'));
    (alert.mock.calls[0]?.[2] as AlertButton[]).find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() =>
      expect(
        writes(calls).some((c) => c.method === 'DELETE' && c.path === '/api/v1/expenses/4/'),
      ).toBe(true),
    );
  });
});
