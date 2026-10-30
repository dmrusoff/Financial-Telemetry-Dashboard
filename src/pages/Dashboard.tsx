import { useState, useEffect, FormEvent, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { CreditCard, DollarSign, Calendar, TrendingUp, RefreshCw, FileText, Moon, Sun, Lock, ChevronDown, ChevronUp, Wallet, Info, X, Crosshair, Settings, LogOut, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CreditCard {
  issuer: string;
  name: string;
  currentBalance: number;
  creditLimit: number;
  paymentDue: number;
  dueDate: string;
  paid: boolean;
}

interface Bill {
  bill: string;
  name: string;
  frequency: string;
  amount: number;
  paid: boolean;
  dueDate: string;
  source: string;
}

interface Income {
  id: string;
  name: string;
  amount: number;
}

interface Investment {
  id: string;
  type: string;
  brokerage: string;
  account: string | null;
  balance: number;
  interest_accrued: number;
}

interface BreakdownItem {
  type: string;
  name: string;
  amount: number;
  dueDate: string;
  reason: string;
  sortDate?: Date;
}

const formatCurrency = (amount: number) => {
  const isNegative = amount < 0;
  const formatted = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isNegative ? `($${formatted})` : `$${formatted}`;
};

interface ExtraTotal {
  label: string;
  subLabel?: string;
  amount: number;
  onClick?: () => void;
}

const BreakdownModal = ({
  isOpen,
  onClose,
  title,
  items,
  totalLabel,
  totalAmount,
  accentColor = "teal",
  primarySubLabel,
  extraTotals
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: BreakdownItem[];
  totalLabel: string;
  totalAmount: number;
  accentColor?: "teal" | "orange" | "purple" | "rose" | "violet";
  primarySubLabel?: string;
  extraTotals?: ExtraTotal[];
}) => {
  if (!isOpen) return null;

  const colorMap = {
    teal: "text-teal-600 dark:text-teal-400",
    orange: "text-orange-600 dark:text-orange-400",
    purple: "text-purple-600 dark:text-purple-400",
    rose: "text-rose-600 dark:text-rose-400",
    violet: "text-violet-600 dark:text-violet-400"
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity" onClick={onClose}>
      <div className="bg-white/90 dark:bg-[#111113]/90 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center relative z-10">
          <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100/50 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors border border-transparent dark:border-white/5 shadow-sm"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto relative z-10">
          <div className="mb-8 bg-gray-50/80 dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex justify-between items-center text-lg">
              <div>
                <span className="font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-sm">{totalLabel}</span>
                {primarySubLabel && (
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-0.5">{primarySubLabel}</p>
                )}
              </div>
              <span className={`text-3xl font-black ${colorMap[accentColor]} tracking-tight`}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
            {extraTotals && extraTotals.map((extra, idx) => (
              <div
                key={idx}
                className={`flex justify-between items-center text-lg mt-4 pt-4 border-t border-gray-200/50 dark:border-white/5 ${extra.onClick ? 'cursor-pointer hover:bg-gray-100/50 dark:hover:bg-white/5 -mx-2 px-2 rounded-xl transition-colors' : ''}`}
                onClick={extra.onClick}
              >
                <div>
                  <span className="font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-sm">{extra.label}</span>
                  {extra.subLabel && (
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-0.5">{extra.subLabel}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {extra.onClick && (
                    <Info className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                  )}
                  <span className={`text-2xl font-black ${colorMap[accentColor]} tracking-tight opacity-75`}>
                    {formatCurrency(extra.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8 font-medium">No items were found.</p>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row justify-between sm:items-center bg-white dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest mr-3 ${item.type === 'Credit Card' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                        item.type === 'Bill' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                          item.type === 'Deposit' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                        {item.type}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-200">{item.name}</span>
                    </div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1.5 pl-1">
                      Due: {item.dueDate}{item.reason ? ` • ${item.reason}` : ''}
                    </div>
                  </div>
                  <div className={`font-mono font-bold mt-3 sm:mt-0 text-right text-lg ${item.amount < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {item.amount < 0 ? '+' : '-'}{formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 rounded-b-[2rem] relative z-10">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center uppercase tracking-widest font-black">
            Data summary as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [greeting, setGreeting] = useState('');
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCardDetailsOpen, setIsCardDetailsOpen] = useState(true);
  const [isBillDetailsOpen, setIsBillDetailsOpen] = useState(true);
  const [checkingBalance, setCheckingBalance] = useState(0);
  const [bankAccountLabel, setBankAccountLabel] = useState('Primary Checking');
  const [showExpectedBalanceDetails, setShowExpectedBalanceDetails] = useState(false);
  const [showRemainingDueDetails, setShowRemainingDueDetails] = useState(false);
  const [showDueThisWeekDetails, setShowDueThisWeekDetails] = useState(false);
  const [showRemainingBillsDetails, setShowRemainingBillsDetails] = useState(false);
  const [showBillsDueWeekDetails, setShowBillsDueWeekDetails] = useState(false);
  const [showFridayBalanceDetails, setShowFridayBalanceDetails] = useState(false);
  const [showNextPaycheckBalanceDetails, setShowNextPaycheckBalanceDetails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Format last updated timestamp with Today/Yesterday/Full date logic
  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();

    // Convert both to EST
    const estOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York' };
    const estDateStr = date.toLocaleDateString('en-US', estOptions);
    const estNowStr = now.toLocaleDateString('en-US', estOptions);

    // Get yesterday in EST
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const estYesterdayStr = yesterday.toLocaleDateString('en-US', estOptions);

    // Format time in EST
    const timeStr = date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (estDateStr === estNowStr) {
      return `Today at ${timeStr}`;
    } else if (estDateStr === estYesterdayStr) {
      return `Yesterday at ${timeStr}`;
    } else {
      const fullDate = date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      return `${fullDate} at ${timeStr}`;
    }
  };

  // Check for existing session on load
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setIsAuthLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });

      if (error) {
        setLoginError(error.message);
      } else {
        setIsAuthenticated(true);
        setLoginError(null);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError(err.message || "A network error occurred. Check CORS or connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  // Idle timeout: Auto-logout after 15 minutes of inactivity (OWASP security recommendation)
  const handleIdleLogout = useCallback(async () => {
    console.log('Session expired due to inactivity');
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setLoginError('Session expired due to inactivity. Please log in again.');
  }, []);

  useIdleTimeout({
    timeout: 15 * 60 * 1000, // 15 minutes
    onIdle: handleIdleLogout,
    enabled: isAuthenticated, // Only track when user is logged in
  });

  const hardcodedCreditData: CreditCard[] = [
    { issuer: 'Chase', name: 'Sapphire Preferred', currentBalance: 840.00, paymentDue: 840.00, paid: false, dueDate: '01/15/2026', creditLimit: 15000 },
    { issuer: 'American Express', name: 'Gold Card', currentBalance: 420.50, paymentDue: 420.50, paid: true, dueDate: '01/10/2026', creditLimit: 20000 },
    { issuer: 'Capital One', name: 'Venture X', currentBalance: 0, paymentDue: 0, paid: true, dueDate: '01/22/2026', creditLimit: 18000 },
    { issuer: 'Citi', name: 'Double Cash', currentBalance: 215.00, paymentDue: 215.00, paid: false, dueDate: '01/28/2026', creditLimit: 10000 }
  ];

  const hardcodedBillsData: Bill[] = [
    { bill: 'Housing', name: 'Primary Mortgage', frequency: 'Monthly', amount: 2200.00, paid: true, dueDate: '01/01/2026', source: 'Checking' },
    { bill: 'Utilities', name: 'Electric & Power', frequency: 'Monthly', amount: 165.00, paid: false, dueDate: '01/15/2026', source: 'Checking' },
    { bill: 'Internet', name: 'Fiber Gigabit', frequency: 'Monthly', amount: 79.99, paid: true, dueDate: '01/18/2026', source: 'Sapphire' },
    { bill: 'Mobile', name: 'Wireless Plan', frequency: 'Monthly', amount: 85.00, paid: false, dueDate: '01/22/2026', source: 'Amex Gold' },
    { bill: 'Insurance', name: 'Auto Policy', frequency: 'Monthly', amount: 145.00, paid: false, dueDate: '01/25/2026', source: 'Checking' }
  ];

  useEffect(() => {
    const updateGreeting = () => {
      const estTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const hour = new Date(estTime).getHours();

      if (hour < 12) {
        setGreeting('Good morning');
      } else if (hour < 18) {
        setGreeting('Good afternoon');
      } else {
        setGreeting('Good evening');
      }
    };

    updateGreeting();
    const interval = setInterval(updateGreeting, 60000);

    document.title = 'Finance Dashboard';

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) return;
      setLoading(true);

      const parseDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        // Convert YYYY-MM-DD to MM/DD/YYYY
        const [year, month, day] = dateStr.split('-');
        return `${month}/${day}/${year}`;
      };

      try {
        // Fetch Credit Cards
        const { data: cardsData, error: cardsError } = await supabase
          .from('credit_cards')
          .select('*')
          .order('sort_order', { ascending: true });

        if (cardsError) throw cardsError;

        if (cardsData) {
          const formattedCards: CreditCard[] = cardsData.map(card => ({
            issuer: card.issuer,
            name: card.name,
            currentBalance: Number(card.current_balance),
            creditLimit: Number(card.credit_limit),
            paymentDue: Number(card.payment_due),
            dueDate: parseDate(card.due_date),
            paid: card.paid
          }));
          setCreditCards(formattedCards);
        } else {
          setCreditCards(hardcodedCreditData);
        }

        // Fetch Bills
        const { data: billsData, error: billsError } = await supabase
          .from('bills')
          .select('*')
          .order('sort_order', { ascending: true });

        if (billsError) throw billsError;

        if (billsData) {
          const formattedBills: Bill[] = billsData.map(bill => ({
            bill: bill.category,
            name: bill.name,
            frequency: bill.frequency,
            amount: Number(bill.amount),
            paid: bill.paid,
            dueDate: parseDate(bill.due_date),
            source: bill.source
          }));
          setBills(formattedBills);
        } else {
          setBills(hardcodedBillsData);
        }

        // Fetch Income
        const { data: incomeData } = await supabase
          .from('income')
          .select('*');

        if (incomeData) {
          setIncome(incomeData);
        }

        // Fetch Primary Checking Balance from Banking table
        const { data: bankingData, error: bankingError } = await supabase
          .from('banking')
          .select('balance, bank, name')
          .order('sort_order', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!bankingError && bankingData) {
          setCheckingBalance(Number(bankingData.balance));
          setBankAccountLabel(`${bankingData.bank} ${bankingData.name}`);
        }

        // Fetch Last Updated timestamp
        const { data: metadataData } = await supabase
          .from('dashboard_metadata')
          .select('updated_at')
          .eq('key', 'last_updated')
          .single();

        if (metadataData) {
          setLastUpdated(metadataData.updated_at);
        }

        // Fetch Investments
        const { data: investmentsData, error: investmentsError } = await supabase
          .from('investments')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!investmentsError && investmentsData) {
          setInvestments(investmentsData);
        }

      } catch (err) {
        console.error('Error fetching from Supabase:', err);
        setCreditCards(hardcodedCreditData);
        setBills(hardcodedBillsData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  const totalBalance = creditCards.reduce((sum, card) => sum + card.currentBalance, 0);
  const totalCreditLimit = creditCards.reduce((sum, card) => sum + card.creditLimit, 0);
  const creditUtilization = totalCreditLimit > 0 ? (totalBalance / totalCreditLimit) * 100 : 0;

  const remainingDueMonth = creditCards.reduce((sum, card) => {
    return sum + (card.paid === false ? card.paymentDue : 0);
  }, 0);

  const remainingDueMonthList = creditCards
    .filter(card => !card.paid && card.paymentDue > 0)
    .map(card => ({
      type: 'Credit Card',
      name: `${card.issuer} ${card.name}`,
      amount: card.paymentDue,
      dueDate: card.dueDate,
      reason: 'Unpaid current month'
    }));

  const getEndOfWeekFriday = () => {
    const now = new Date();
    const estNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const dayOfWeek = estNow.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 7 - dayOfWeek + 5;
    const friday = new Date(estNow);
    friday.setDate(estNow.getDate() + daysUntilFriday);
    friday.setHours(23, 59, 59, 999);
    return friday;
  };

  const fridayDate = getEndOfWeekFriday().toLocaleDateString('en-US');
  const currentMonthLong = new Date().toLocaleDateString('en-US', { month: 'long' });

  const isDueThisWeek = (dueDateString: string, paid: boolean) => {
    if (paid || !dueDateString) return false;
    const dueDate = new Date(dueDateString);
    const endOfWeek = getEndOfWeekFriday();
    return dueDate <= endOfWeek;
  };

  // Calculate Credit Cards Due This Week (Logic mirrors Expected Balance)
  const calculateResultDueWeek = () => {
    let sum = 0;
    const list: BreakdownItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = getEndOfWeekFriday();

    creditCards.forEach(card => {
      if (card.paymentDue > 0 && card.dueDate) {
        try {
          const dueDate = new Date(card.dueDate);

          // 1. Current Month: Include if unpaid and within range (today <= date <= endOfWeek)
          // Actually, if it's unpaid and <= endOfWeek, we count it (even if it was yesterday?)
          // Usually 'isDueThisWeek' implies strict range, but for a "Due" summary, overdue + upcoming this week is best.
          // let's stick to "unpaid and <= endOfWeek" for current month correctness.
          if (!card.paid && dueDate <= endOfWeek) {
            sum += card.paymentDue;
            list.push({
              type: 'Credit Card',
              name: `${card.issuer} ${card.name}`,
              amount: card.paymentDue,
              dueDate: card.dueDate,
              reason: '',
              sortDate: dueDate
            });
          }

          // 2. Next Month Projection: Always check if it falls in range
          const nextMonthDate = new Date(dueDate);
          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

          // Check if proper projection
          if (nextMonthDate >= today && nextMonthDate <= endOfWeek) {
            sum += card.paymentDue;
            list.push({
              type: 'Credit Card',
              name: `${card.issuer} ${card.name}`,
              amount: card.paymentDue,
              dueDate: nextMonthDate.toLocaleDateString(),
              reason: '',
              sortDate: nextMonthDate
            });
          }

        } catch (e) { console.error(e); }
      }
    });

    // Sort list by date
    list.sort((a, b) => (a.sortDate && b.sortDate) ? a.sortDate.getTime() - b.sortDate.getTime() : 0);

    return { sum, list };
  };

  const { sum: remainingDueWeek, list: remainingDueWeekList } = calculateResultDueWeek();

  const totalBillsAmount = bills.reduce((sum, bill) => {
    let amountToAdd = 0;
    const frequency = bill.frequency.toLowerCase();

    if (frequency === 'monthly') {
      amountToAdd = bill.amount;
    } else if (frequency === 'yearly') {
      amountToAdd = bill.amount / 12;
    } else if (frequency === 'weekly') {
      amountToAdd = bill.amount * 4;
    } else {
      // Default to monthly if unknown, or maybe 0? 
      // Assuming standard monthly for anything else based on request implying these 3 types.
      // Let's stick to adding it as is (Monthly) to be safe, or 0 if strictly only these.
      // The user said "if a bill is monthly... if yearly... if weekly...". 
      // I'll assume others are Monthly or just add raw amount.
      amountToAdd = bill.amount;
    }

    return sum + amountToAdd;
  }, 0);

  const remainingBills = bills.reduce((sum, bill) => {
    return sum + (bill.paid === false && bill.frequency === 'Monthly' ? bill.amount : 0);
  }, 0);

  const remainingBillsList = bills
    .filter(bill => !bill.paid && bill.frequency === 'Monthly' && bill.amount > 0)
    .map(bill => ({
      type: 'Bill',
      name: `${bill.bill} - ${bill.name}`,
      amount: bill.amount,
      dueDate: bill.dueDate,
      reason: 'Unpaid Monthly bill'
    }));

  // Calculate Bills Due This Week (Logic mirrors Expected Balance)
  const calculateBillsDueWeek = () => {
    let sum = 0;
    const list: BreakdownItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = getEndOfWeekFriday();

    bills.forEach(bill => {
      if (bill.amount > 0 && bill.dueDate) {
        try {
          const dueDate = new Date(bill.dueDate);

          // 1. Current Month/Cycle: Include if unpaid and within range
          if (!bill.paid && dueDate <= endOfWeek) {
            sum += bill.amount;
            list.push({
              type: 'Bill',
              name: `${bill.bill} - ${bill.name}`,
              amount: bill.amount,
              dueDate: bill.dueDate,
              reason: '',
              sortDate: dueDate
            });
          }

          // 2. Next Month Projection (Monthly only)
          if (bill.frequency === 'Monthly') {
            const nextMonthDate = new Date(dueDate);
            nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

            if (nextMonthDate >= today && nextMonthDate <= endOfWeek) {
              sum += bill.amount;
              list.push({
                type: 'Bill',
                name: `${bill.bill} - ${bill.name}`,
                amount: bill.amount,
                dueDate: nextMonthDate.toLocaleDateString(),
                reason: '',
                sortDate: nextMonthDate
              });
            }
          }
        } catch (e) { console.error(e); }
      }
    });

    // Sort list by date
    list.sort((a, b) => (a.sortDate && b.sortDate) ? a.sortDate.getTime() - b.sortDate.getTime() : 0);

    return { sum, list };
  };

  const { sum: billsDueWeek, list: billsDueWeekList } = calculateBillsDueWeek();

  const getNextPaycheckDate = () => {
    // Bi-weekly Fridays starting from a known reference point (Dec 12, 2025)
    const referenceDate = new Date('2025-12-12T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextPaycheck = new Date(referenceDate);
    while (nextPaycheck <= today) {
      nextPaycheck.setDate(nextPaycheck.getDate() + 14);
    }
    return nextPaycheck;
  };

  const calculateExpectedBalance = () => {
    const nextPaycheck = getNextPaycheckDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expected = checkingBalance;
    const includedPayments: any[] = [];

    console.log('=== Expected Balance Calculation ===');
    console.log('Starting Balance:', checkingBalance);
    console.log('Today:', today.toLocaleDateString());
    console.log('Next Paycheck:', nextPaycheck.toLocaleDateString());

    // Subtract credit card payments due
    creditCards.forEach(card => {
      if (card.paymentDue > 0 && card.dueDate) {
        try {
          const dueDate = new Date(card.dueDate);

          // Current month: only if unpaid
          if (!card.paid && dueDate < nextPaycheck) {
            expected -= card.paymentDue;
            includedPayments.push({
              type: 'Credit Card',
              name: `${card.issuer} ${card.name}`,
              amount: card.paymentDue,
              dueDate: card.dueDate,
              reason: '',
              sortDate: dueDate
            });
          }

          // Next month projection: include all cards (since they are recurring)
          if (nextPaycheck.getMonth() > today.getMonth() || nextPaycheck.getFullYear() > today.getFullYear()) {
            const nextMonthDate = new Date(dueDate);
            nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

            if (nextMonthDate >= today && nextMonthDate < nextPaycheck) {
              expected -= card.paymentDue;
              includedPayments.push({
                type: 'Credit Card',
                name: `${card.issuer} ${card.name}`,
                amount: card.paymentDue,
                dueDate: nextMonthDate.toLocaleDateString(),
                reason: '',
                sortDate: nextMonthDate
              });
            }
          }
        } catch (e) {
          console.error('Error parsing date', card.dueDate);
        }
      }
    });

    // Subtract bills
    bills.forEach(bill => {
      if (bill.amount > 0 && bill.dueDate) {
        try {
          const dueDate = new Date(bill.dueDate);

          // For current month: only subtract if unpaid
          if (!bill.paid && dueDate < nextPaycheck) {
            expected -= bill.amount;
            includedPayments.push({
              type: 'Bill',
              name: `${bill.bill} - ${bill.name}`,
              amount: bill.amount,
              dueDate: bill.dueDate,
              reason: '',
              sortDate: dueDate
            });
          }

          // For next month projection: include all monthly bills
          if (nextPaycheck.getMonth() > today.getMonth() || nextPaycheck.getFullYear() > today.getFullYear()) {
            const nextMonthDate = new Date(dueDate);
            nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

            if (nextMonthDate >= today && nextMonthDate < nextPaycheck && bill.frequency === 'Monthly') {
              expected -= bill.amount;
              includedPayments.push({
                type: 'Bill',
                name: `${bill.bill} - ${bill.name}`,
                amount: bill.amount,
                dueDate: nextMonthDate.toLocaleDateString(),
                reason: '',
                sortDate: nextMonthDate
              });
            }
          }
        } catch (e) {
          console.error('Error parsing date', bill.dueDate);
        }
      }
    });

    // Social Security Deposit Logic: 4th Wednesday of the month
    const getFourthWednesday = (year: number, month: number) => {
      const date = new Date(year, month, 1);

      // Find the first Wednesday
      while (date.getDay() !== 3) {
        date.setDate(date.getDate() + 1);
      }

      // Add 3 weeks to get the 4th Wednesday
      date.setDate(date.getDate() + 21);
      return date;
    };

    const addSocialSecurityDeposit = (targetDate: Date) => {
      // If the deposit date is strictly between today (exclusive) and nextPaycheck (exclusive), add it
      // OR if it's today (inclusive) depending on how "today" is treated. 
      // Usually deposits available today are already in "Checking Balance", so we strictly look for future deposits.
      // However, if the user wants "expected balance before next paycheck", and a deposit comes tomorrow, it should be included.

      // Reset hours for accurate comparison
      const depositDate = new Date(targetDate);
      depositDate.setHours(0, 0, 0, 0);

      if (depositDate > today && depositDate < nextPaycheck) {
        // Find Social Security income
        const ssIncome = income.find(i => i.name.toLowerCase().includes('social security'));
        const amount = ssIncome ? ssIncome.amount : 0; // Default if not found

        expected += amount;
        includedPayments.push({
          type: 'Deposit',
          name: 'Social Security',
          amount: -amount, // Negative amount for display in list (since it's a credit) or handle in UI logic
          dueDate: depositDate.toLocaleDateString(),
          reason: '',
          sortDate: depositDate
        });
      }
    };

    // Check current month's 4th Wednesday
    const currentMonth4thWed = getFourthWednesday(today.getFullYear(), today.getMonth());
    addSocialSecurityDeposit(currentMonth4thWed);

    // Check next month's 4th Wednesday (if range spans to next month)
    if (nextPaycheck.getMonth() !== today.getMonth() || nextPaycheck.getFullYear() !== today.getFullYear()) {
      const nextMonth4thWed = getFourthWednesday(today.getFullYear(), today.getMonth() + 1);
      addSocialSecurityDeposit(nextMonth4thWed);
    }

    // Sort all items strictly by date (chronologically)
    includedPayments.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

    console.log('Included Payments:', includedPayments);
    console.log('Total Deductions:', checkingBalance - expected);
    console.log('Expected Balance:', expected);
    console.log('===================================');

    return { expected, includedPayments };
  };

  const { expected: expectedBalance, includedPayments: expectedBalanceDetails } = calculateExpectedBalance();
  const nextPaycheckDate = getNextPaycheckDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Get next week's Friday (always at least 7 days out)
  const getNextFriday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0=Sun, 5=Fri
    const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
    // Always add 7 to get NEXT week's Friday, not this week's
    const daysToAdd = daysUntilFriday === 0 ? 14 : daysUntilFriday + 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysToAdd);
    return nextFriday;
  };

  // Calculate expected balance by the following Friday
  const calculateExpectedBalanceFriday = () => {
    const nextFriday = getNextFriday();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expected = checkingBalance;
    const includedPayments: any[] = [];

    // Subtract credit card payments due before Friday
    creditCards.forEach(card => {
      if (card.paymentDue > 0 && card.dueDate) {
        try {
          const dueDate = new Date(card.dueDate);
          if (!card.paid && dueDate >= today && dueDate < nextFriday) {
            expected -= card.paymentDue;
            includedPayments.push({
              type: 'Credit Card',
              name: `${card.issuer} ${card.name}`,
              amount: card.paymentDue,
              dueDate: card.dueDate,
              reason: '',
              sortDate: dueDate
            });
          }
        } catch (e) { console.error(e); }
      }
    });

    // Subtract bills due before Friday
    bills.forEach(bill => {
      if (bill.amount > 0 && bill.dueDate) {
        try {
          const dueDate = new Date(bill.dueDate);
          if (!bill.paid && dueDate >= today && dueDate < nextFriday) {
            expected -= bill.amount;
            includedPayments.push({
              type: 'Bill',
              name: `${bill.bill} - ${bill.name}`,
              amount: bill.amount,
              dueDate: bill.dueDate,
              reason: '',
              sortDate: dueDate
            });
          }
        } catch (e) { console.error(e); }
      }
    });

    // Social Security Deposit: 4th Wednesday of the month
    const getFourthWednesday = (year: number, month: number) => {
      const date = new Date(year, month, 1);
      while (date.getDay() !== 3) date.setDate(date.getDate() + 1);
      date.setDate(date.getDate() + 21);
      return date;
    };

    const currentMonth4thWed = getFourthWednesday(today.getFullYear(), today.getMonth());
    const cm4w = new Date(currentMonth4thWed);
    cm4w.setHours(0, 0, 0, 0);
    if (cm4w > today && cm4w < nextFriday) {
      const ssIncome = income.find(i => i.name.toLowerCase().includes('social security'));
      const amount = ssIncome ? ssIncome.amount : 0;
      expected += amount;
      includedPayments.push({
        type: 'Deposit',
        name: 'Social Security',
        amount: -amount,
        dueDate: cm4w.toLocaleDateString(),
        reason: '',
        sortDate: cm4w
      });
    }

    // Check next month's 4th Wednesday if range spans months
    if (nextFriday.getMonth() !== today.getMonth() || nextFriday.getFullYear() !== today.getFullYear()) {
      const nextMonth4thWed = getFourthWednesday(today.getFullYear(), today.getMonth() + 1);
      const nm4w = new Date(nextMonth4thWed);
      nm4w.setHours(0, 0, 0, 0);
      if (nm4w > today && nm4w < nextFriday) {
        const ssIncome = income.find(i => i.name.toLowerCase().includes('social security'));
        const amount = ssIncome ? ssIncome.amount : 0;
        expected += amount;
        includedPayments.push({
          type: 'Deposit',
          name: 'Social Security',
          amount: -amount,
          dueDate: nm4w.toLocaleDateString(),
          reason: '',
          sortDate: nm4w
        });
      }
    }

    // Include paycheck if one falls before Friday
    const nextPaycheck = getNextPaycheckDate();
    if (nextPaycheck > today && nextPaycheck < nextFriday) {
      const paycheckInc = income.find(i => i.name.toLowerCase().includes('paycheck'));
      if (paycheckInc) {
        expected += paycheckInc.amount;
        includedPayments.push({
          type: 'Deposit',
          name: 'Paycheck',
          amount: -paycheckInc.amount,
          dueDate: nextPaycheck.toLocaleDateString(),
          reason: '',
          sortDate: nextPaycheck
        });
      }
    }

    // Sort by date
    includedPayments.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

    return { expected, includedPayments };
  };

  const { expected: expectedBalanceFriday, includedPayments: fridayBalanceDetails } = calculateExpectedBalanceFriday();
  const nextFridayDate = getNextFriday().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Get the paycheck after next
  const getPaycheckAfterNext = () => {
    const nextPaycheck = getNextPaycheckDate();
    const afterNext = new Date(nextPaycheck);
    afterNext.setDate(afterNext.getDate() + 14);
    return afterNext;
  };

  // Calculate expected balance before the paycheck after next
  const calculateExpectedBalanceNextPaycheck = () => {
    const cutoff = getPaycheckAfterNext();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expected = checkingBalance;
    const includedPayments: any[] = [];

    // Add current paycheck (since it falls before the cutoff)
    const nextPaycheck = getNextPaycheckDate();
    if (nextPaycheck > today && nextPaycheck < cutoff) {
      const paycheckInc = income.find(i => i.name.toLowerCase().includes('paycheck'));
      if (paycheckInc) {
        expected += paycheckInc.amount;
        includedPayments.push({
          type: 'Deposit',
          name: 'Paycheck',
          amount: -paycheckInc.amount,
          dueDate: nextPaycheck.toLocaleDateString(),
          reason: '',
          sortDate: nextPaycheck
        });
      }
    }

    // Subtract credit card payments due before cutoff
    creditCards.forEach(card => {
      if (card.paymentDue > 0 && card.dueDate) {
        try {
          const dueDate = new Date(card.dueDate);

          // Current month unpaid
          if (!card.paid && dueDate < cutoff) {
            expected -= card.paymentDue;
            includedPayments.push({
              type: 'Credit Card',
              name: `${card.issuer} ${card.name}`,
              amount: card.paymentDue,
              dueDate: card.dueDate,
              reason: '',
              sortDate: dueDate
            });
          }

          // Next month projection
          if (cutoff.getMonth() > today.getMonth() || cutoff.getFullYear() > today.getFullYear()) {
            const nextMonthDate = new Date(dueDate);
            nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
            if (nextMonthDate >= today && nextMonthDate < cutoff) {
              expected -= card.paymentDue;
              includedPayments.push({
                type: 'Credit Card',
                name: `${card.issuer} ${card.name}`,
                amount: card.paymentDue,
                dueDate: nextMonthDate.toLocaleDateString(),
                reason: '',
                sortDate: nextMonthDate
              });
            }
          }
        } catch (e) { console.error(e); }
      }
    });

    // Subtract bills due before cutoff
    bills.forEach(bill => {
      if (bill.amount > 0 && bill.dueDate) {
        try {
          const dueDate = new Date(bill.dueDate);

          if (!bill.paid && dueDate < cutoff) {
            expected -= bill.amount;
            includedPayments.push({
              type: 'Bill',
              name: `${bill.bill} - ${bill.name}`,
              amount: bill.amount,
              dueDate: bill.dueDate,
              reason: '',
              sortDate: dueDate
            });
          }

          if ((cutoff.getMonth() > today.getMonth() || cutoff.getFullYear() > today.getFullYear()) && bill.frequency === 'Monthly') {
            const nextMonthDate = new Date(dueDate);
            nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
            if (nextMonthDate >= today && nextMonthDate < cutoff) {
              expected -= bill.amount;
              includedPayments.push({
                type: 'Bill',
                name: `${bill.bill} - ${bill.name}`,
                amount: bill.amount,
                dueDate: nextMonthDate.toLocaleDateString(),
                reason: '',
                sortDate: nextMonthDate
              });
            }
          }
        } catch (e) { console.error(e); }
      }
    });

    // Social Security Deposit: 4th Wednesday
    const getFourthWednesday = (year: number, month: number) => {
      const date = new Date(year, month, 1);
      while (date.getDay() !== 3) date.setDate(date.getDate() + 1);
      date.setDate(date.getDate() + 21);
      return date;
    };

    const addSSDeposit = (targetDate: Date) => {
      const depositDate = new Date(targetDate);
      depositDate.setHours(0, 0, 0, 0);
      if (depositDate > today && depositDate < cutoff) {
        const ssIncome = income.find(i => i.name.toLowerCase().includes('social security'));
        const amount = ssIncome ? ssIncome.amount : 0;
        expected += amount;
        includedPayments.push({
          type: 'Deposit',
          name: 'Social Security',
          amount: -amount,
          dueDate: depositDate.toLocaleDateString(),
          reason: '',
          sortDate: depositDate
        });
      }
    };

    addSSDeposit(getFourthWednesday(today.getFullYear(), today.getMonth()));
    if (cutoff.getMonth() !== today.getMonth() || cutoff.getFullYear() !== today.getFullYear()) {
      addSSDeposit(getFourthWednesday(today.getFullYear(), today.getMonth() + 1));
    }

    includedPayments.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
    return { expected, includedPayments };
  };

  const { expected: expectedBalanceNextPaycheck, includedPayments: nextPaycheckBalanceDetails } = calculateExpectedBalanceNextPaycheck();
  const paycheckAfterNextDate = getPaycheckAfterNext().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Get paycheck amount from income database
  const paycheckIncome = income.find(i => i.name.toLowerCase().includes('paycheck'));
  const paycheckAmount = paycheckIncome ? paycheckIncome.amount : 0;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 transition-colors relative overflow-hidden bg-gray-50 dark:bg-[#08080a]">
        {/* Animated Background Elements */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 dark:bg-indigo-600/20 blur-[120px] animate-pulse pointer-events-none duration-1000" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/20 dark:bg-teal-700/20 blur-[120px] animate-pulse pointer-events-none duration-1000" style={{ animationDelay: '2s' }} />

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute top-6 right-6 z-10 group p-2.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-white/10 transition-all duration-300"
        >
          {darkMode ? <Sun className="w-5 h-5 text-yellow-500 group-hover:rotate-90 transition-transform duration-500" /> : <Moon className="w-5 h-5 text-gray-700 group-hover:-rotate-12 transition-transform duration-300" />}
        </button>

        <div className="bg-white/80 dark:bg-[#111113]/80 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 rounded-[2rem] shadow-2xl p-8 sm:p-12 w-full max-w-[440px] relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-lg shadow-indigo-500/30">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight mb-2">Access Control</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Verify your identity to proceed</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Email</label>
              <div className="relative group">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-white/5 bg-white/50 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                  placeholder="name@domain.com"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-white/5 bg-white/50 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                placeholder="••••••••"
              />
              {loginError && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  {loginError}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 disabled:opacity-50 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-indigo-500/30 mt-4"
            >
              <span className="relative z-10 flex items-center justify-center gap-2 font-bold tracking-wide">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Authenticating
                  </>
                ) : 'Secure Sign In'}
              </span>
              <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <div className="text-xl text-gray-600 mb-2">Loading dashboard...</div>
          <div className="text-sm text-gray-500">Fetching data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#060608] p-4 sm:p-8 transition-colors relative overflow-hidden">
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[400px] bg-indigo-500/10 dark:bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-1">

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {greeting}, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">{import.meta.env.VITE_USER_NAME || 'Dashboard'}</span>
            </h1>
            <div className="flex items-center gap-3 mt-2">
              {lastUpdated && (
                <div className="flex items-center gap-2 bg-white/50 dark:bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-200/50 dark:border-white/10 shadow-sm">
                  <span className={`w-2 h-2 rounded-full ${formatLastUpdated(lastUpdated).startsWith('Today')
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                    : formatLastUpdated(lastUpdated).startsWith('Yesterday')
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                    }`} />
                  <p className="text-sm font-bold tracking-wide text-gray-600 dark:text-gray-300">
                    Last Updated: <span className="font-medium text-gray-500 dark:text-gray-400">{formatLastUpdated(lastUpdated)}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              to="/admin"
              className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-white/10 transition-all duration-300 text-gray-700 dark:text-white"
            >
              <Settings className="w-4 h-4 text-indigo-500 group-hover:rotate-90 transition-transform duration-500" />
              <span className="font-bold tracking-wide text-sm">Admin</span>
            </Link>
            <button
              onClick={handleLogout}
              className="group p-2.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-sm hover:shadow-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-300 text-gray-400 hover:text-red-500"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="group p-2.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-white/10 transition-all duration-300"
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-500 group-hover:rotate-90 transition-transform duration-500" /> : <Moon className="w-5 h-5 text-gray-700 group-hover:-rotate-12 transition-transform duration-300" />}
            </button>
          </div>
        </div>

        <div className="mb-12">
          <div className="flex items-center mb-6 pl-2 border-l-4 border-indigo-500">
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3 ml-2">
              <Wallet className="w-6 h-6 text-indigo-500" />
              Cash Flow
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Current Balance */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Current Balance</p>
                  <p className="text-sm font-bold text-emerald-600/70 dark:text-emerald-400/70">{bankAccountLabel}</p>
                </div>
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight ml-16">
                {formatCurrency(checkingBalance)}
              </h3>
            </div>

            {/* Expected Balance */}
            <div
              className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group cursor-pointer"
              onClick={() => setShowExpectedBalanceDetails(true)}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-teal-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-6 h-6 text-teal-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Expected Balance</p>
                  <p className="text-sm font-bold text-teal-600/70 dark:text-teal-400/70">Before next paycheck</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 ml-16">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {formatCurrency(expectedBalance)}
                </h3>
                <Info className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors" />
              </div>
            </div>

            {/* Next Paycheck */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="w-6 h-6 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Next Paycheck</p>
                  <p className="text-sm font-bold text-indigo-600/70 dark:text-indigo-400/70">Amount: {formatCurrency(paycheckAmount)}</p>
                </div>
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight ml-16">
                {nextPaycheckDate}
              </h3>
            </div>
          </div>
        </div>

        {/* Investments */}
        <div className="mb-12">
          <div className="flex items-center mb-6 pl-2 border-l-4 border-emerald-500">
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3 ml-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              Investments
            </h2>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-gray-100 dark:border-gray-800/60 shadow-xl bg-white/70 dark:bg-[#111113]/50 backdrop-blur-xl">
            <table className="w-full">
              <thead className="bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                <tr>
                  {/* Combined column on mobile, separate on desktop */}
                  <th className="pl-4 sm:pl-6 pr-1 sm:pr-0 py-4 text-left text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    <span className="sm:hidden">Account</span>
                    <span className="hidden sm:inline">Type</span>
                  </th>
                  <th className="pl-1 sm:pl-0 pr-1 sm:pr-2 py-4 text-left text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest hidden sm:table-cell">Brokerage</th>
                  <th className="pl-1 sm:pl-2 pr-4 sm:pr-6 py-4 text-center text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest hidden sm:table-cell">Account</th>

                  <th className="px-4 sm:px-6 py-4 text-right text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {investments.map((investment) => (
                  <tr key={investment.id} className="hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors duration-200">
                    {/* Combined Type/Brokerage on mobile, just Type on desktop */}
                    <td className="pl-4 sm:pl-6 pr-1 sm:pr-0 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{investment.type}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">{investment.brokerage}</div>
                    </td>
                    <td className="pl-1 sm:pl-0 pr-1 sm:pr-2 py-3 sm:py-4 whitespace-nowrap text-sm sm:text-base text-gray-700 dark:text-gray-300 hidden sm:table-cell">{investment.brokerage}</td>
                    <td className="pl-1 sm:pl-2 pr-4 sm:pr-6 py-3 sm:py-4 whitespace-nowrap text-sm font-mono text-gray-400 dark:text-gray-500 text-center hidden sm:table-cell">{investment.account || '—'}</td>

                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm sm:text-base font-mono text-gray-900 dark:text-gray-200 text-right">
                      {formatCurrency(investment.balance)}
                    </td>
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className="bg-emerald-50/50 dark:bg-emerald-500/10 font-bold border-t border-emerald-200 dark:border-emerald-500/20">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm sm:text-base text-emerald-800 dark:text-emerald-400">
                    <span className="hidden sm:inline">Total (Balance + Interest)</span>
                    <span className="sm:hidden">Total</span>
                  </td>
                  <td className="hidden sm:table-cell" colSpan={2}></td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-base sm:text-lg font-mono text-emerald-700 dark:text-emerald-300 text-right" colSpan={2}>
                    {formatCurrency(investments.reduce((sum, inv) => sum + inv.balance + inv.interest_accrued, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown Modals */}
        <BreakdownModal
          isOpen={showExpectedBalanceDetails}
          onClose={() => setShowExpectedBalanceDetails(false)}
          title="Expected Balance Breakdown"
          totalLabel="Expected Balance"
          primarySubLabel="Before next paycheck"
          totalAmount={expectedBalance}
          items={expectedBalanceDetails}
          accentColor="teal"
          extraTotals={[
            {
              label: 'Expected by Friday',
              subLabel: `Through ${nextFridayDate}`,
              amount: expectedBalanceFriday,
              onClick: () => {
                setShowExpectedBalanceDetails(false);
                setShowFridayBalanceDetails(true);
              }
            },
            {
              label: 'Before Paycheck After Next',
              subLabel: `Through ${paycheckAfterNextDate}`,
              amount: expectedBalanceNextPaycheck,
              onClick: () => {
                setShowExpectedBalanceDetails(false);
                setShowNextPaycheckBalanceDetails(true);
              }
            }
          ]}
        />

        <BreakdownModal
          isOpen={showFridayBalanceDetails}
          onClose={() => setShowFridayBalanceDetails(false)}
          title={`Expected Balance by ${nextFridayDate}`}
          totalLabel="Expected by Friday"
          primarySubLabel={`Through ${nextFridayDate}`}
          totalAmount={expectedBalanceFriday}
          items={fridayBalanceDetails}
          accentColor="teal"
        />

        <BreakdownModal
          isOpen={showNextPaycheckBalanceDetails}
          onClose={() => setShowNextPaycheckBalanceDetails(false)}
          title={`Expected Balance by ${paycheckAfterNextDate}`}
          totalLabel="Before Paycheck After Next"
          primarySubLabel={`Through ${paycheckAfterNextDate}`}
          totalAmount={expectedBalanceNextPaycheck}
          items={nextPaycheckBalanceDetails}
          accentColor="teal"
        />

        <BreakdownModal
          isOpen={showRemainingDueDetails}
          onClose={() => setShowRemainingDueDetails(false)}
          title="Credit Card: Remaining Due"
          totalLabel="Total Unpaid"
          totalAmount={remainingDueMonth}
          items={remainingDueMonthList}
          accentColor="orange"
        />

        <BreakdownModal
          isOpen={showDueThisWeekDetails}
          onClose={() => setShowDueThisWeekDetails(false)}
          title="Credit Card: Due This Week"
          totalLabel="Weekly Total"
          totalAmount={remainingDueWeek}
          items={remainingDueWeekList}
          accentColor="purple"
        />

        <BreakdownModal
          isOpen={showRemainingBillsDetails}
          onClose={() => setShowRemainingBillsDetails(false)}
          title="Bills: Remaining Due"
          totalLabel="Total Unpaid"
          totalAmount={remainingBills}
          items={remainingBillsList}
          accentColor="rose"
        />

        <BreakdownModal
          isOpen={showBillsDueWeekDetails}
          onClose={() => setShowBillsDueWeekDetails(false)}
          title="Bills: Due This Week"
          totalLabel="Weekly Total"
          totalAmount={billsDueWeek}
          items={billsDueWeekList}
          accentColor="violet"
        />

        <div className="mb-12">
          <div className="flex items-center mb-6 pl-2 border-l-4 border-purple-500">
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3 ml-2">
              <CreditCard className="w-6 h-6 text-purple-500" />
              Credit Profile
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Utilization */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group">
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300 ${creditUtilization < 30 ? 'bg-blue-500/10' :
                  creditUtilization < 50 ? 'bg-yellow-500/10' :
                    'bg-red-500/10'
                  }`}>
                  <CreditCard className={`w-6 h-6 ${creditUtilization < 30 ? 'text-blue-500' :
                    creditUtilization < 50 ? 'text-yellow-500' :
                      'text-red-500'
                    }`} />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Balance</p>
                  <p className={`text-sm font-bold ${creditUtilization < 30 ? 'text-blue-600/70 dark:text-blue-400/70' :
                    creditUtilization < 50 ? 'text-yellow-600/70 dark:text-yellow-400/70' :
                      'text-red-600/70 dark:text-red-400/70'
                    }`}>{creditUtilization.toFixed(1)}% Utilization • ${totalCreditLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })} Limit</p>
                </div>
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight ml-16">
                {formatCurrency(totalBalance)}
              </h3>
              {/* <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-wide">
                ${totalCreditLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })} Limit • {creditCards.length} Cards
              </p> */}
            </div>

            {/* Remaining Due Month */}
            <div
              className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group cursor-pointer"
              onClick={() => setShowRemainingDueDetails(true)}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-orange-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Current Month Due</p>
                  <p className="text-sm font-bold text-orange-600/70 dark:text-orange-400/70">Remaining for {currentMonthLong}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 ml-16">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {formatCurrency(remainingDueMonth)}
                </h3>
                <Info className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-orange-500 transition-colors" />
              </div>
              {/* <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-wide">Unpaid current month</p> */}
            </div>

            {/* Due This Week */}
            <div
              className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group cursor-pointer"
              onClick={() => setShowDueThisWeekDetails(true)}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Due This Week</p>
                  <p className="text-sm font-bold text-purple-600/70 dark:text-purple-400/70">Due by Friday {fridayDate}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 ml-16">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {formatCurrency(remainingDueWeek)}
                </h3>
                <Info className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-purple-500 transition-colors" />
              </div>
              {/* <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-wide">Weekly obligations</p> */}
            </div>
          </div>
        </div>

        <div className="mb-12">
          <div className="flex items-center mb-6 pl-2 border-l-4 border-cyan-500">
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3 ml-2">
              <FileText className="w-6 h-6 text-cyan-500" />
              Upcoming Obligations
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Bills */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Bills</p>
                  <p className="text-sm font-bold text-cyan-600/70 dark:text-cyan-400/70">Monthly obligations</p>
                </div>
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight ml-16">
                {formatCurrency(totalBillsAmount)}
              </h3>
            </div>

            {/* Remaining Bills Month */}
            <div
              className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group cursor-pointer"
              onClick={() => setShowRemainingBillsDetails(true)}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-rose-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Current Month Due</p>
                  <p className="text-sm font-bold text-rose-600/70 dark:text-rose-400/70">Remaining for {currentMonthLong}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 ml-16">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {formatCurrency(remainingBills)}
                </h3>
                <Info className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-rose-500 transition-colors" />
              </div>
              {/* <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-wide">Regular monthly bills</p> */}
            </div>

            {/* Bills Due Week */}
            <div
              className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 group cursor-pointer"
              onClick={() => setShowBillsDueWeekDetails(true)}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-violet-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-6 h-6 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Due This Week</p>
                  <p className="text-sm font-bold text-violet-600/70 dark:text-violet-400/70">Due by Friday {fridayDate}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 ml-16">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {formatCurrency(billsDueWeek)}
                </h3>
                <Info className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-violet-500 transition-colors" />
              </div>
              {/* <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-wide">Weekly obligations</p> */}
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-[#111113]/50 backdrop-blur-xl border border-gray-100 dark:border-gray-800/60 rounded-[2rem] shadow-xl overflow-hidden mb-8 transition-colors group">
          <div
            className="p-8 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all duration-300"
            onClick={() => setIsCardDetailsOpen(!isCardDetailsOpen)}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/10 group-hover:scale-110 transition-transform">
                <CreditCard className="w-6 h-6 text-indigo-500" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Credit Card Details Breakdown</h2>
            </div>
            <div className={`p-2 rounded-full transition-colors ${isCardDetailsOpen ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-gray-50 dark:bg-gray-800'}`}>
              {isCardDetailsOpen ? (
                <ChevronUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              )}
            </div>
          </div>
          {isCardDetailsOpen && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Card</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Balance</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Limit</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Utilization</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Payment Due</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Due Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {creditCards.map((card, index) => {
                    const cardUtilization = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
                    return (
                      <tr key={index} className={isDueThisWeek(card.dueDate, card.paid) ? "bg-rose-50/80 dark:bg-rose-500/10 hover:bg-rose-100/80 dark:hover:bg-rose-500/20 transition-colors duration-200 border-l-2 border-rose-500" : "hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors duration-200 border-l-2 border-transparent"}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-base font-medium text-gray-900 dark:text-white">{card.issuer}</div>
                          <div className="text-base text-gray-500 dark:text-gray-400">{card.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900 dark:text-gray-200">
                          {formatCurrency(card.currentBalance)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500 dark:text-gray-400">
                          ${card.creditLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base">
                          <span className={`font-medium ${cardUtilization < 30 ? 'text-green-600' :
                            cardUtilization < 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                            {cardUtilization.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900 dark:text-gray-200">
                          {formatCurrency(card.paymentDue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900 dark:text-gray-200">
                          {card.dueDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {card.paid ? (
                            <span className="inline-flex text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full font-medium whitespace-nowrap">
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex text-xs px-2 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-medium whitespace-nowrap">
                              Due
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white/70 dark:bg-[#111113]/50 backdrop-blur-xl border border-gray-100 dark:border-gray-800/60 rounded-[2rem] shadow-xl overflow-hidden transition-colors group">
          <div
            className="p-8 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all duration-300"
            onClick={() => setIsBillDetailsOpen(!isBillDetailsOpen)}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/10 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-indigo-500" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Bill Details Breakdown</h2>
            </div>
            <div className={`p-2 rounded-full transition-colors ${isBillDetailsOpen ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-gray-50 dark:bg-gray-800'}`}>
              {isBillDetailsOpen ? (
                <ChevronUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              )}
            </div>
          </div>
          {isBillDetailsOpen && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Bill</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Frequency</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Due Date</th>

                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {bills.map((bill, index) => (
                    <tr key={index} className={isDueThisWeek(bill.dueDate, bill.paid) ? "bg-rose-50/80 dark:bg-rose-500/10 hover:bg-rose-100/80 dark:hover:bg-rose-500/20 transition-colors duration-200 border-l-2 border-rose-500" : "hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors duration-200 border-l-2 border-transparent"}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base font-medium text-gray-900 dark:text-white">{bill.bill}</div>
                        <div className="text-base text-gray-500 dark:text-gray-400">{bill.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500 dark:text-gray-400">
                        {bill.frequency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900 dark:text-gray-200">
                        {formatCurrency(bill.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900 dark:text-gray-200">
                        {bill.dueDate}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {bill.paid ? (
                          <span className="inline-flex text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full font-medium whitespace-nowrap">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex text-xs px-2 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-medium whitespace-nowrap">
                            Due
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div >
    </div >
  );
};

export default Dashboard;