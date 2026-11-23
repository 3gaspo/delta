import type { FeatureSection } from '@3gaspo/app-ui/Tutorial';

export const featureGuide = [
  {
    title: 'Transactions and history',
    entries: [
      { title: 'Expenses, income and transfers', text: 'Use the add button on Home. Choose a payment account, amount and date. Categorise or tag the entry and add a note if needed. A transfer moves money between two accounts and is excluded from income and spending.' },
      { title: 'Pending and hidden', text: 'Pending entries are marked for follow-up and still count. Use Hidden to keep an entry in history without counting it in balances, spending or statistics. An expense you want to exclude entirely from your totals can use this status.' },
      { title: 'Find or edit an entry', text: 'Search the history or filter by account and transaction type. Use the entry’s edit or delete action to correct it. Expand a group to see its individual expenses.' },
    ],
  },
  {
    title: 'Group transactions',
    entries: [
      { title: 'Choose one payer', text: 'Switch to Group Transaction when adding an expense. Choose the regular account that paid the bill, or choose External if someone else paid.' },
      { title: 'Split the bill', text: 'Add a row for each share. Enter amounts directly or enter the total and divide it by ratios. Delta allocates cents so the shares add up to the total.' },
      { title: 'Choose whose expense it is', text: 'Give every share a debt account and mark it For me or For others. Only your shares count towards personal spending. If you paid for others, those shares increase what they owe you. If an external payer covered your share, it increases what you owe.' },
      { title: 'Example', text: 'If you pay €60 and €20 is yours, record €20 For me and €40 For others with the relevant debt account. The paying account goes down €60, personal spending is €20 and the amount owed to you goes up €40.' },
    ],
  },
  {
    title: 'Accounts and debts',
    entries: [
      { title: 'Set up accounts', text: 'Use regular accounts for money you hold and debt accounts for balances between you and someone else. Enter a starting balance as needed. You can reorder, archive or hide accounts from the overview.' },
      { title: 'Read a debt balance', text: 'A positive debt balance means someone owes you money. A negative one means you owe money. A repayment can be logged as a transfer between the debt account and a regular account.' },
      { title: 'Shared accounts', text: 'Set your ownership and default personal spending shares when an account is shared. The account ledger keeps the full movements. Personal totals use your share, with a transaction-specific share taking precedence when supplied.' },
      { title: 'Read the overview', text: 'Accounts shows your available balance, what you are owed and what you owe. Overview totals exclude hidden accounts. Personal net worth combines your regular account balances with signed debt balances.' },
    ],
  },
  {
    title: 'Recurring transactions and forecasts',
    entries: [
      { title: 'Set up a rule', text: 'In Accounts, create a recurring expense, income or transfer, choose the interval and first date, and edit or pause it later. Delta generates due occurrences as they come up, including dates missed while you were away.' },
      { title: 'Remove a rule', text: 'When deleting a recurring rule, you can keep or remove its generated history.' },
      { title: 'Monthly Plan', text: 'Delta converts active recurring amounts to monthly personal shares. For a budgeted category it uses the larger of its budget and its matching recurring amounts. Recurring amounts outside a budgeted category are added separately. This gives a typical month.', formula: 'Planned monthly change = expected income − expected expenses\nPlanned net worth = current net worth + planned monthly change' },
      { title: 'Cash-flow alerts', text: 'Delta projects actual account movements and recurring payments over the next 60 days to flag balances that may fall below zero. This forecast uses full account amounts and leaves out category budgets.' },
    ],
  },
  {
    title: 'Statistics and budgets',
    entries: [
      { title: 'Account evolution', text: 'Follow a specific account or total net worth over time. Switch the period and use the category, tag or debt controls to choose what the graphs include.' },
      { title: 'Cash flow and spending', text: 'Compare income and expenses, then see spending by category. Shared transactions use your personal share. Hidden entries are excluded.' },
      { title: 'Budgets and averages', text: 'Set category budgets in Settings. Statistics shows the current month against the budget and the historical average when enough full periods are available. Averages omit the first partial period and the period still in progress.' },
    ],
  },
  {
    title: 'Bank import',
    entries: [
      { title: 'Import a draft', text: 'Install the Delta userscript from Bank import. It reads EUR transactions already loaded on supported CIC or BoursoBank pages. Start the import on the bank page, then choose the destination account and review the draft in Delta.' },
      { title: 'Review before saving', text: 'Check dates and amounts, any flagged duplicates, and the entries you want to keep. Delta only adds the transactions you confirm.' },
    ],
  },
  {
    title: 'Settings, export and resets',
    entries: [
      { title: 'Personalise Delta', text: 'Create categories with colours and budgets, manage tags, choose EUR, USD, JPY or GBP as the display currency, and switch between light and dark.' },
      { title: 'Account and CSV', text: 'Manage your sign-in or download transaction data as CSV from Settings. Local development sessions keep their data in the browser. Firebase sessions use the signed-in account.' },
      { title: 'Reset data', text: 'Clear History removes transactions and recurring rules. Reset All Data also removes custom accounts, categories and tags and restores the starting data and settings.' },
    ],
  },
] as const satisfies readonly FeatureSection[];
