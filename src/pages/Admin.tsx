import { useState, useEffect, useCallback } from 'react';
import { adminSupabase as supabase } from '../lib/supabase';
import { ChevronLeft, Plus, Trash2, Sun, Moon, GripVertical, Loader2, Lock, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFavicon } from '../hooks/useFavicon';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { PlaidLink, SyncPlaidBalances, ManagePlaidConnections } from '../components/PlaidLink';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CreditCard {
    id: string;
    issuer: string;
    name: string;
    current_balance: number;
    credit_limit: number;
    payment_due: number;
    due_date: string | null;
    paid: boolean;
    sort_order: number;
    plaid_access_token?: string;
    plaid_item_id?: string;
    plaid_account_id?: string;
    last_plaid_sync?: string;
}

interface Bill {
    id: string;
    category: string;
    name: string;
    frequency: string;
    amount: number;
    paid: boolean;
    due_date: string | null;
    source: string;
    sort_order: number;
}

interface BankingAccount {
    id: string;
    name: string;
    bank: string;
    account: string | null;
    balance: number;
    sort_order: number;
    plaid_access_token?: string;
    plaid_item_id?: string;
    plaid_account_id?: string;
    last_plaid_sync?: string;
}

interface Investment {
    id: string;
    type: string;
    brokerage: string;
    account: string | null;
    balance: number;
    interest_accrued: number;
    sort_order: number;
    plaid_access_token?: string;
    plaid_item_id?: string;
    plaid_account_id?: string;
    last_plaid_sync?: string;
}

interface Income {
    id: string;
    name: string;
    amount: number;
    sort_order: number;
}
// Sortable Row Component
const SortableRow = ({ id, children, onClick, className }: { id: string; children: React.ReactNode; onClick?: () => void; className: string }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <tr ref={setNodeRef} style={style} className={className} onClick={onClick}>
            <td className="px-2 py-3 w-10">
                <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" onClick={e => e.stopPropagation()}>
                    <GripVertical className="w-4 h-4 text-gray-400" />
                </button>
            </td>
            {children}
        </tr>
    );
};


const Admin = () => {
    // Use admin favicon (gear icon) for this page
    useFavicon('admin');

    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [bills, setBills] = useState<Bill[]>([]);
    const [bankingAccounts, setBankingAccounts] = useState<BankingAccount[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [income, setIncome] = useState<Income[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    // Modal editing state
    type EditModalType = 'income' | 'banking' | 'investment' | 'card' | 'bill' | null;
    const [editModalType, setEditModalType] = useState<EditModalType>(null);
    const [editingItem, setEditingItem] = useState<any>(null);

    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);

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

    // Idle timeout: Auto-logout after 15 minutes of inactivity (OWASP security recommendation)
    const handleIdleLogout = useCallback(async () => {
        console.log('Admin session expired due to inactivity');
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setLoginError('Session expired due to inactivity. Please log in again.');
    }, []);

    useIdleTimeout({
        timeout: 15 * 60 * 1000, // 15 minutes
        onIdle: handleIdleLogout,
        enabled: isAuthenticated, // Only track when user is logged in
    });

    const handleLogin = async (e: React.FormEvent) => {
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

    useEffect(() => {
        if (!supabase) {
            console.error("Supabase credentials missing");
            setLoading(false);
            return;
        }
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]); // Re-fetch data when authentication status changes

    // Update the last_updated timestamp in dashboard_metadata
    const updateLastUpdated = async () => {
        if (!supabase) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('dashboard_metadata')
                .upsert({
                    user_id: user.id,
                    key: 'last_updated',
                    value: 'Admin panel update',
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,key'
                });
        } catch (error) {
            console.error('Error updating last_updated timestamp:', error);
        }
    };

    const fetchData = async () => {
        if (!supabase) return;
        setLoading(true);
        try {
            const { data: cards } = await supabase
                .from('credit_cards')
                .select('*')
                .order('sort_order', { ascending: true });

            const { data: billsData } = await supabase
                .from('bills')
                .select('*')
                .order('sort_order', { ascending: true });

            const { data: bankingData } = await supabase
                .from('banking')
                .select('*')
                .order('sort_order', { ascending: true });

            const { data: investmentsData } = await supabase
                .from('investments')
                .select('*')
                .order('sort_order', { ascending: true });

            const { data: incomeData } = await supabase
                .from('income')
                .select('*')
                .order('sort_order', { ascending: true });

            if (cards) setCreditCards(cards);
            if (billsData) setBills(billsData);
            if (bankingData) setBankingAccounts(bankingData);
            if (investmentsData) setInvestments(investmentsData);
            if (incomeData) setIncome(incomeData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };


    const syncCardDates = async () => {
        if (!supabase) return;
        if (!confirm("This will update all Credit Card due dates to the current month. Continue?")) return;

        setLoading(true);
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-indexed for string formatting

        // Get the max days in the target month
        const maxDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();

        try {
            const updatedCards = creditCards.map(card => {
                if (!card.due_date) return card;
                // Extract the original day directly from the YYYY-MM-DD string
                const originalDay = parseInt(card.due_date.split('-')[2], 10);
                // Clamp the day to the max days in the target month
                const clampedDay = Math.min(originalDay, maxDaysInMonth);
                const newDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
                return { ...card, due_date: newDate };
            });

            const cardUpdates = updatedCards.map(c => supabase.from('credit_cards').update({ due_date: c.due_date }).eq('id', c.id));
            await Promise.all(cardUpdates);
            setCreditCards(updatedCards);
            await updateLastUpdated();
        } catch (error) {
            console.error("Error syncing card dates", error);
        } finally {
            setLoading(false);
        }
    };

    const syncBillDates = async () => {
        if (!supabase) return;
        if (!confirm("This will update all Monthly bill due dates to the current month. Continue?")) return;

        setLoading(true);
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-indexed for string formatting

        // Get the max days in the target month
        const maxDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();

        try {
            const updatedBills = bills.map(bill => {
                if (!bill.due_date || bill.frequency !== 'Monthly') return bill;
                // Extract the original day directly from the YYYY-MM-DD string
                const originalDay = parseInt(bill.due_date.split('-')[2], 10);
                // Clamp the day to the max days in the target month
                const clampedDay = Math.min(originalDay, maxDaysInMonth);
                const newDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
                return { ...bill, due_date: newDate };
            });

            const billUpdates = updatedBills.map(b => supabase.from('bills').update({ due_date: b.due_date }).eq('id', b.id));
            await Promise.all(billUpdates);
            setBills(updatedBills);
            await updateLastUpdated();
        } catch (error) {
            console.error("Error syncing bill dates", error);
        } finally {
            setLoading(false);
        }
    };

    const uncheckAllCards = async () => {
        if (!supabase) return;
        if (!confirm("This will mark all Credit Cards as UNPAID. Continue?")) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('credit_cards')
                .update({ paid: false })
                .is('paid', true);

            if (error) throw error;
            setCreditCards(prev => prev.map(c => ({ ...c, paid: false })));
            await updateLastUpdated();
        } catch (error) {
            console.error("Error unchecking cards", error);
        } finally {
            setLoading(false);
        }
    };

    const uncheckAllBills = async () => {
        if (!supabase) return;
        if (!confirm("This will mark all Bills as UNPAID. Continue?")) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('bills')
                .update({ paid: false })
                .is('paid', true);

            if (error) throw error;
            setBills(prev => prev.map(b => ({ ...b, paid: false })));
            await updateLastUpdated();
        } catch (error) {
            console.error("Error unchecking bills", error);
        } finally {
            setLoading(false);
        }
    };

    const addNewCard = async () => {
        if (!supabase) return;
        const newCard = {
            issuer: 'New Bank',
            name: 'New Card',
            current_balance: 0,
            credit_limit: 0,
            payment_due: 0,
            paid: false,
            sort_order: creditCards.length + 1
        };
        const { data } = await supabase.from('credit_cards').insert(newCard).select().single();
        if (data) {
            setCreditCards([...creditCards, data]);
            await updateLastUpdated();
        }
    };

    const addNewBill = async () => {
        if (!supabase) return;
        const newBill = {
            category: 'New Category',
            name: 'New Bill',
            frequency: 'Monthly',
            amount: 0,
            paid: false,
            sort_order: bills.length + 1
        };
        const { data } = await supabase.from('bills').insert(newBill).select().single();
        if (data) {
            setBills([...bills, data]);
            await updateLastUpdated();
        }
    };

    const addNewIncome = async () => {
        if (!supabase) return;
        const newIncome = {
            name: 'New Income Source',
            amount: 0,
            sort_order: income.length + 1
        };
        const { data } = await supabase.from('income').insert(newIncome).select().single();
        if (data) {
            setIncome([...income, data]);
            await updateLastUpdated();
        }
    };


    const deleteItem = async (table: 'credit_cards' | 'bills' | 'banking' | 'investments' | 'income', id: string) => {
        if (!supabase) return;
        if (!confirm('Are you sure you want to delete this item?')) return;

        await supabase.from(table).delete().eq('id', id);
        if (table === 'credit_cards') {
            setCreditCards(prev => prev.filter(c => c.id !== id));
        } else if (table === 'bills') {
            setBills(prev => prev.filter(b => b.id !== id));
        } else if (table === 'banking') {
            setBankingAccounts(prev => prev.filter(b => b.id !== id));
        } else if (table === 'investments') {
            setInvestments(prev => prev.filter(i => i.id !== id));
        } else if (table === 'income') {
            setIncome(prev => prev.filter(i => i.id !== id));
        }
        await updateLastUpdated();
    };


    const addNewBankingAccount = async () => {
        if (!supabase) return;
        const newAccount = {
            name: 'New Account',
            bank: 'New Bank',
            account: '',
            balance: 0,
            sort_order: bankingAccounts.length + 1
        };
        const { data } = await supabase.from('banking').insert(newAccount).select().single();
        if (data) {
            setBankingAccounts([...bankingAccounts, data]);
            await updateLastUpdated();
        }
    };


    const addNewInvestment = async () => {
        if (!supabase) return;
        const newInvestment = {
            type: 'New Type',
            brokerage: 'New Brokerage',
            account: '',
            balance: 0,
            interest_accrued: 0,
            sort_order: investments.length + 1
        };
        const { data } = await supabase.from('investments').insert(newInvestment).select().single();
        if (data) {
            setInvestments([...investments, data]);
            await updateLastUpdated();
        }
    };


    const [darkMode, setDarkMode] = useState(true);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Modal handlers
    const openEditModal = (type: EditModalType, item: any) => {
        setEditModalType(type);
        setEditingItem({ ...item }); // Clone to allow cancel
    };

    const closeEditModal = () => {
        setEditModalType(null);
        setEditingItem(null);
    };

    const saveEditModal = async () => {
        if (!editingItem || !editModalType || !supabase) return;
        setSavingId(editingItem.id);

        try {
            if (editModalType === 'income') {
                const updates = {
                    name: editingItem.name,
                    amount: editingItem.amount,
                    sort_order: editingItem.sort_order
                };
                await supabase.from('income').update(updates).eq('id', editingItem.id);
                setIncome(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...updates } : i));
            } else if (editModalType === 'banking') {
                const updates = {
                    name: editingItem.name,
                    bank: editingItem.bank,
                    account: editingItem.account,
                    balance: editingItem.balance,
                    sort_order: editingItem.sort_order,
                    plaid_access_token: editingItem.plaid_access_token,
                    plaid_item_id: editingItem.plaid_item_id,
                    plaid_account_id: editingItem.plaid_account_id,
                    last_plaid_sync: editingItem.last_plaid_sync
                };
                await supabase.from('banking').update(updates).eq('id', editingItem.id);
                setBankingAccounts(prev => prev.map(a => a.id === editingItem.id ? { ...a, ...updates } : a));
            } else if (editModalType === 'investment') {
                const updates = {
                    type: editingItem.type,
                    brokerage: editingItem.brokerage,
                    account: editingItem.account,
                    balance: editingItem.balance,
                    interest_accrued: editingItem.interest_accrued,
                    sort_order: editingItem.sort_order,
                    plaid_access_token: editingItem.plaid_access_token,
                    plaid_item_id: editingItem.plaid_item_id,
                    plaid_account_id: editingItem.plaid_account_id,
                    last_plaid_sync: editingItem.last_plaid_sync
                };
                await supabase.from('investments').update(updates).eq('id', editingItem.id);
                setInvestments(prev => prev.map(inv => inv.id === editingItem.id ? { ...inv, ...updates } : inv));
            } else if (editModalType === 'card') {
                const updates = {
                    issuer: editingItem.issuer,
                    name: editingItem.name,
                    credit_limit: editingItem.credit_limit,
                    current_balance: editingItem.current_balance,
                    payment_due: editingItem.payment_due,
                    due_date: editingItem.due_date,
                    paid: editingItem.paid,
                    sort_order: editingItem.sort_order,
                    plaid_access_token: editingItem.plaid_access_token,
                    plaid_item_id: editingItem.plaid_item_id,
                    plaid_account_id: editingItem.plaid_account_id,
                    last_plaid_sync: editingItem.last_plaid_sync
                };
                await supabase.from('credit_cards').update(updates).eq('id', editingItem.id);
                setCreditCards(prev => prev.map(c => c.id === editingItem.id ? { ...c, ...updates } : c));
            } else if (editModalType === 'bill') {
                const updates = {
                    category: editingItem.category,
                    name: editingItem.name,
                    frequency: editingItem.frequency,
                    amount: editingItem.amount,
                    due_date: editingItem.due_date,
                    paid: editingItem.paid,
                    source: editingItem.source,
                    sort_order: editingItem.sort_order
                };
                await supabase.from('bills').update(updates).eq('id', editingItem.id);
                setBills(prev => prev.map(b => b.id === editingItem.id ? { ...b, ...updates } : b));
            }
            await updateLastUpdated();
        } catch (error) {
            console.error('Error saving changes:', error);
        } finally {
            setSavingId(null);
            closeEditModal();
        }
    };

    // Toggle paid status directly (without modal)
    const togglePaid = async (type: 'card' | 'bill', id: string, currentPaid: boolean) => {
        if (!supabase) return;
        setSavingId(id);

        const tableName = type === 'card' ? 'credit_cards' : 'bills';
        const newPaid = !currentPaid;

        try {
            await supabase.from(tableName).update({ paid: newPaid }).eq('id', id);

            if (type === 'card') {
                setCreditCards(prev => prev.map(c => c.id === id ? { ...c, paid: newPaid } : c));
            } else {
                setBills(prev => prev.map(b => b.id === id ? { ...b, paid: newPaid } : b));
            }
            await updateLastUpdated();
        } catch (error) {
            console.error('Error toggling paid status:', error);
        } finally {
            setSavingId(null);
        }
    };

    // Format date from YYYY-MM-DD to MM/DD/YYYY
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        const [year, month, day] = dateStr.split('-');
        return `${month}/${day}/${year}`;
    };

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Handle drag end for any table type
    const handleDragEnd = async (
        event: DragEndEvent,
        items: any[],
        setItems: React.Dispatch<React.SetStateAction<any[]>>,
        tableName: string
    ) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !supabase) return;

        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);

        const reorderedItems = arrayMove(items, oldIndex, newIndex);

        // Update sort_order for all affected items
        const updatedItems = reorderedItems.map((item, index) => ({
            ...item,
            sort_order: index + 1
        }));

        setItems(updatedItems);

        // Batch update to database
        try {
            for (const item of updatedItems) {
                await supabase.from(tableName).update({ sort_order: item.sort_order }).eq('id', item.id);
            }
            await updateLastUpdated();
        } catch (error) {
            console.error('Error updating sort order:', error);
        }
    };





    // Modal title helper
    const getModalTitle = () => {
        if (!editModalType) return '';
        return {
            income: 'Edit Income',
            banking: 'Edit Banking Account',
            investment: 'Edit Investment',
            card: 'Edit Credit Card',
            bill: 'Edit Bill'
        }[editModalType];
    };

    if (isAuthLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 transition-colors relative overflow-hidden bg-slate-50 dark:bg-slate-900">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 dark:bg-indigo-600/20 blur-[120px] animate-pulse pointer-events-none duration-1000" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/20 dark:bg-teal-700/20 blur-[120px] animate-pulse pointer-events-none duration-1000" style={{ animationDelay: '2s' }} />
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin relative z-10" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 transition-colors relative overflow-hidden bg-slate-50 dark:bg-slate-900">
                {/* Animated Background Elements */}
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 dark:bg-indigo-600/20 blur-[120px] animate-pulse pointer-events-none duration-1000" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/20 dark:bg-teal-700/20 blur-[120px] animate-pulse pointer-events-none duration-1000" style={{ animationDelay: '2s' }} />

                <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="absolute top-6 right-6 z-10 group p-2.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-white/10 transition-all duration-300"
                >
                    {darkMode ? <Sun className="w-5 h-5 text-yellow-500 group-hover:rotate-90 transition-transform duration-500" /> : <Moon className="w-5 h-5 text-gray-700 group-hover:-rotate-12 transition-transform duration-300" />}
                </button>

                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 rounded-[2rem] shadow-2xl p-8 sm:p-12 w-full max-w-[440px] relative z-10">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-lg shadow-indigo-500/30">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight mb-2">Admin Control</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Restricted access area</p>
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
                                    placeholder="admin@domain.com"
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
                                        Authenticating...
                                    </>
                                ) : (
                                    'Secure Login'
                                )}
                            </span>
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) return <div className="p-8">Loading admin panel...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white transition-colors relative overflow-hidden">
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[400px] bg-indigo-500/10 dark:bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />
            {/* Edit Modal - Inlined to prevent focus loss */}
            {editModalType && editingItem && (
                <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity" onMouseDown={closeEditModal}>
                    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl border border-gray-200/50 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-extrabold tracking-tight">{getModalTitle()}</h3>
                            <button type="button" onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">✕</button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); saveEditModal(); }}>
                            <div className="p-6 space-y-4">
                                {editModalType === 'income' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Name</label>
                                            <input type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Amount</label>
                                            <input type="number" value={editingItem.amount} onChange={e => setEditingItem({ ...editingItem, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Sort Order</label>
                                            <input type="number" value={editingItem.sort_order || 0} onChange={e => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                    </>
                                )}
                                {editModalType === 'banking' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Name</label>
                                            <input type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Bank</label>
                                            <input type="text" value={editingItem.bank} onChange={e => setEditingItem({ ...editingItem, bank: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Account</label>
                                            <input type="text" value={editingItem.account || ''} onChange={e => setEditingItem({ ...editingItem, account: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Balance</label>
                                            <input type="number" step="0.01" value={editingItem.balance} onChange={e => setEditingItem({ ...editingItem, balance: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Sort Order</label>
                                            <input type="number" value={editingItem.sort_order || 0} onChange={e => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        {editingItem.plaid_access_token && (
                                            <div className="pt-4 border-t border-gray-100 dark:border-white/10 mt-2">
                                                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                    <div>
                                                        <div className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 mb-1">Plaid Connected</div>
                                                        <div className="text-[10px] font-mono text-gray-400 truncate w-32">{editingItem.plaid_account_id}</div>
                                                    </div>
                                                    <button type="button" onClick={() => { if(confirm('Disconnect Plaid?')) setEditingItem({...editingItem, plaid_access_token: null, plaid_item_id: null, plaid_account_id: null, last_plaid_sync: null}); }} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all">Disconnect</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {editModalType === 'investment' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Type</label>
                                            <input type="text" value={editingItem.type} onChange={e => setEditingItem({ ...editingItem, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Brokerage</label>
                                            <input type="text" value={editingItem.brokerage} onChange={e => setEditingItem({ ...editingItem, brokerage: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Account</label>
                                            <input type="text" value={editingItem.account || ''} onChange={e => setEditingItem({ ...editingItem, account: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Balance</label>
                                            <input type="number" step="0.01" value={editingItem.balance} onChange={e => setEditingItem({ ...editingItem, balance: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Interest Accrued</label>
                                            <input type="number" step="0.01" value={editingItem.interest_accrued} onChange={e => setEditingItem({ ...editingItem, interest_accrued: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Sort Order</label>
                                            <input type="number" value={editingItem.sort_order || 0} onChange={e => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                        </div>
                                        {editingItem.plaid_access_token && (
                                            <div className="pt-4 border-t border-gray-100 dark:border-white/10 mt-2">
                                                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                    <div>
                                                        <div className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 mb-1">Plaid Connected</div>
                                                        <div className="text-[10px] font-mono text-gray-400 truncate w-32">{editingItem.plaid_account_id}</div>
                                                    </div>
                                                    <button type="button" onClick={() => { if(confirm('Disconnect Plaid?')) setEditingItem({...editingItem, plaid_access_token: null, plaid_item_id: null, plaid_account_id: null, last_plaid_sync: null}); }} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all">Disconnect</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {editModalType === 'card' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Issuer</label>
                                                <input type="text" value={editingItem.issuer} onChange={e => setEditingItem({ ...editingItem, issuer: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Card Name</label>
                                                <input type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Credit Limit</label>
                                                <input type="number" step="0.01" value={editingItem.credit_limit} onChange={e => setEditingItem({ ...editingItem, credit_limit: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Due Date</label>
                                                <input type="date" value={editingItem.due_date || ''} onChange={e => setEditingItem({ ...editingItem, due_date: e.target.value || null })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Current Balance</label>
                                                <input type="number" step="0.01" value={editingItem.current_balance} onChange={e => setEditingItem({ ...editingItem, current_balance: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Payment Due</label>
                                                <input type="number" step="0.01" value={editingItem.payment_due} onChange={e => setEditingItem({ ...editingItem, payment_due: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Sort Order</label>
                                                <input type="number" value={editingItem.sort_order || 0} onChange={e => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                            <div className="flex items-center pt-6">
                                                <input type="checkbox" checked={editingItem.paid} onChange={e => setEditingItem({ ...editingItem, paid: e.target.checked })} className="w-5 h-5 text-indigo-600 rounded mr-2" />
                                                <label className="text-sm font-medium">Paid</label>
                                            </div>
                                        </div>
                                        {editingItem.plaid_access_token && (
                                            <div className="pt-4 border-t border-gray-100 dark:border-white/10 mt-2">
                                                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                    <div>
                                                        <div className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 mb-1">Plaid Connected</div>
                                                        <div className="text-[10px] font-mono text-gray-400 truncate w-32">{editingItem.plaid_account_id}</div>
                                                    </div>
                                                    <button type="button" onClick={() => { if(confirm('Disconnect Plaid?')) setEditingItem({...editingItem, plaid_access_token: null, plaid_item_id: null, plaid_account_id: null, last_plaid_sync: null}); }} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all">Disconnect</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {editModalType === 'bill' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Category</label>
                                                <input type="text" value={editingItem.category} onChange={e => setEditingItem({ ...editingItem, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Provider</label>
                                                <input type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Frequency</label>
                                                <select value={editingItem.frequency} onChange={e => setEditingItem({ ...editingItem, frequency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                                                    <option value="Monthly">Monthly</option>
                                                    <option value="Weekly">Weekly</option>
                                                    <option value="Yearly">Yearly</option>
                                                    <option value="Biannual">Biannual</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Amount</label>
                                                <input type="number" step="0.01" value={editingItem.amount} onChange={e => setEditingItem({ ...editingItem, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Due Date</label>
                                                <input type="date" value={editingItem.due_date || ''} onChange={e => setEditingItem({ ...editingItem, due_date: e.target.value || null })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Source</label>
                                                <select value={editingItem.source || ''} onChange={e => setEditingItem({ ...editingItem, source: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                                                    <option value="">Select Source</option>
                                                    <option value="BofA">BofA</option>
                                                    <option value="Truist">Truist</option>
                                                    <option value="Quicksilver">Quicksilver</option>
                                                    <option value="Apple Card">Apple Card</option>
                                                    <option value="Venture One">Venture One</option>
                                                    <option value="State Farm">State Farm</option>
                                                    <option value="Discover">Discover</option>
                                                    <option value="Barclays">Barclays</option>
                                                    <option value="World Elite">World Elite</option>
                                                    <option value="Chase Freedom">Chase Freedom</option>
                                                    <option value="Robinhood">Robinhood</option>
                                                    <option value="BMO">BMO</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Sort Order</label>
                                                <input type="number" value={editingItem.sort_order || 0} onChange={e => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
                                            </div>
                                            <div className="flex items-center pt-6">
                                                <input type="checkbox" checked={editingItem.paid} onChange={e => setEditingItem({ ...editingItem, paid: e.target.checked })} className="w-5 h-5 text-indigo-600 rounded mr-2" />
                                                <label className="text-sm font-medium">Paid</label>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="p-6 border-t border-gray-200 dark:border-white/10 flex justify-between items-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const tableName = editModalType === 'card' ? 'credit_cards' : editModalType === 'investment' ? 'investments' : editModalType === 'bill' ? 'bills' : editModalType || '';
                                        if (editingItem?.id && confirm('Are you sure you want to delete this item?')) {
                                            deleteItem(tableName, editingItem.id);
                                            closeEditModal();
                                        }
                                    }}
                                    className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors ring-1 ring-inset ring-red-500/20"
                                    title="Delete"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <div className="flex gap-3">
                                    <button type="button" onClick={closeEditModal} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
                                    <button type="submit" disabled={savingId === editingItem?.id} className="px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all">
                                        {savingId === editingItem?.id ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
                <Link to="/" className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-bold tracking-wide mb-8 group transition-colors">
                    <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                </Link>

                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400">
                        Admin Control Center
                    </h1>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="group p-2.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-white/10 transition-all duration-300"
                            title="Toggle Dark Mode"
                        >
                            {darkMode ? <Sun className="w-5 h-5 text-yellow-500 group-hover:rotate-90 transition-transform duration-500" /> : <Moon className="w-5 h-5 text-gray-700 group-hover:-rotate-12 transition-transform duration-300" />}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="group p-2.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 shadow-sm hover:shadow-lg hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300"
                            title="Sign Out"
                        >
                            <LogOut className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-red-500 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Plaid Status Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-white/5 p-6 rounded-[2rem] shadow-lg">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Plaid Engine Status</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-gray-900 dark:text-white">
                                {[...bankingAccounts, ...creditCards, ...investments].filter(a => a.plaid_access_token).length}
                            </span>
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-tighter">Connected Accounts</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
                                Items: {new Set([...bankingAccounts.map(a => a.plaid_item_id), ...creditCards.map(a => a.plaid_item_id), ...investments.map(a => a.plaid_item_id)].filter(Boolean)).size} / 100
                            </div>
                            <div className="w-16 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 transition-all duration-1000" 
                                    style={{ width: `${Math.min(100, (new Set([...bankingAccounts.map(a => a.plaid_item_id), ...creditCards.map(a => a.plaid_item_id), ...investments.map(a => a.plaid_item_id)].filter(Boolean)).size / 100) * 100)}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                    <ManagePlaidConnections onSuccess={fetchData} />
                    <SyncPlaidBalances onSuccess={fetchData} variant="card" />
                    <PlaidLink onSuccess={fetchData} table="banking" variant="card" />
                </div>

                <section className="mb-12">
                    <div className="flex justify-between items-center mb-6 pl-2 border-l-4 border-indigo-500">
                        <h2 className="text-2xl font-extrabold tracking-tight ml-2">Income</h2>
                        <button onClick={addNewIncome} className="flex items-center bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/30">
                            <Plus className="w-4 h-4 mr-2" /> Add Income
                        </button>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50 rounded-[2rem] shadow-xl overflow-hidden mt-4">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, income, setIncome, 'income')}>
                            <table className="w-full text-base text-left">
                                <thead className="bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                                    <tr>
                                        <th className="px-2 py-4 w-10"></th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Name</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    <SortableContext items={income.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                        {income.map((item) => (
                                            <SortableRow
                                                key={item.id}
                                                id={item.id}
                                                className={`hover:bg-indigo-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors`}
                                                onClick={() => openEditModal('income', item)}
                                            >
                                                <td className="px-4 py-4 font-medium">{item.name}</td>
                                                <td className="px-4 py-4 font-mono text-center">${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                            </SortableRow>
                                        ))}
                                    </SortableContext>
                                </tbody>
                            </table>
                        </DndContext>
                    </div>
                </section>

                <section className="mb-12">
                    <div className="flex justify-between items-center mb-6 pl-2 border-l-4 border-indigo-500">
                        <h2 className="text-2xl font-extrabold tracking-tight ml-2">Banking</h2>
                        <div className="flex gap-4">
                            <button onClick={addNewBankingAccount} className="flex items-center bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/30">
                                <Plus className="w-4 h-4 mr-2" /> Add Account
                            </button>
                        </div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50 rounded-[2rem] shadow-xl overflow-hidden mt-4">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, bankingAccounts, setBankingAccounts, 'banking')}>
                            <table className="w-full text-base text-left">
                                <thead className="bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                                    <tr>
                                        <th className="px-2 py-4 w-10"></th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Name</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Bank</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Account</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    <SortableContext items={bankingAccounts.map(a => a.id)} strategy={verticalListSortingStrategy}>
                                        {bankingAccounts.map((account) => (
                                            <SortableRow
                                                key={account.id}
                                                id={account.id}
                                                className={`hover:bg-indigo-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors`}
                                                onClick={() => openEditModal('banking', account)}
                                            >
                                                <td className="px-4 py-4 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {account.name}
                                                        {account.plaid_access_token ? (
                                                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">
                                                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                                                Live
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {account.last_plaid_sync && (
                                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal mt-0.5">
                                                            Synced {new Date(account.last_plaid_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">{account.bank}</td>
                                                <td className="px-4 py-4 font-mono text-sm text-gray-400 dark:text-gray-500 text-center">{account.account || (account.plaid_account_id ? 'Plaid ID' : '—')}</td>
                                                <td className="px-4 py-4 font-mono text-center">${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                            </SortableRow>
                                        ))}
                                    </SortableContext>
                                </tbody>
                            </table>
                        </DndContext>
                    </div>
                </section>

                {/* Investments Section */}
                <section className="mb-12">
                    <div className="flex justify-between items-center mb-6 pl-2 border-l-4 border-indigo-500">
                        <h2 className="text-2xl font-extrabold tracking-tight ml-2">Investments</h2>
                        <div className="flex gap-4">
                            <button onClick={addNewInvestment} className="flex items-center bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/30">
                                <Plus className="w-4 h-4 mr-2" /> Add Investment
                            </button>
                        </div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50 rounded-[2rem] shadow-xl overflow-hidden mt-4">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, investments, setInvestments, 'investments')}>
                            <table className="w-full text-base text-left">
                                <thead className="bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                                    <tr>
                                        <th className="px-2 py-4 w-10"></th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Type</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Brokerage</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Account</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Balance</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Interest Accrued</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    <SortableContext items={investments.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                        {investments.map((investment) => (
                                            <SortableRow
                                                key={investment.id}
                                                id={investment.id}
                                                className={`hover:bg-indigo-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors`}
                                                onClick={() => openEditModal('investment', investment)}
                                            >
                                                <td className="px-4 py-4 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {investment.type}
                                                        {investment.plaid_access_token ? (
                                                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">
                                                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                                                Live
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {investment.last_plaid_sync && (
                                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal mt-0.5">
                                                            Synced {new Date(investment.last_plaid_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">{investment.brokerage}</td>
                                                <td className="px-4 py-4 font-mono text-sm text-gray-400 dark:text-gray-500 text-center">{investment.account || '—'}</td>
                                                <td className="px-4 py-4 font-mono text-center">${investment.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-4 font-mono text-emerald-600 dark:text-emerald-400 text-center">${investment.interest_accrued.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                            </SortableRow>
                                        ))}
                                    </SortableContext>
                                </tbody>
                            </table>
                        </DndContext>
                    </div>
                </section>

                {/* Credit Cards Section */}
                <section className="mb-12">
                    <div className="flex justify-between items-center mb-6 pl-2 border-l-4 border-indigo-500">
                        <h2 className="text-2xl font-extrabold tracking-tight ml-2">Credit Cards</h2>
                        <div className="flex gap-4">
                            <button
                                onClick={syncCardDates}
                                className="bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide shadow-lg shadow-indigo-500/30 transition-all"
                            >
                                Sync Card Dates
                            </button>
                            <button
                                onClick={uncheckAllCards}
                                className="bg-red-600/90 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide shadow-lg shadow-red-500/30 transition-all"
                            >
                                Uncheck All Paid
                            </button>
                            <button onClick={addNewCard} className="flex items-center bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/30">
                                <Plus className="w-4 h-4 mr-2" /> Add Card
                            </button>
                        </div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50 rounded-[2rem] shadow-xl overflow-hidden mt-4">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, creditCards, setCreditCards, 'credit_cards')}>
                            <table className="w-full text-base text-left">
                                <thead className="bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                                    <tr>
                                        <th className="px-2 py-4 w-10"></th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Issuer</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Name</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Limit</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Balance</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Due</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Date</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Paid</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    <SortableContext items={creditCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                        {creditCards.map((card) => (
                                            <SortableRow
                                                key={card.id}
                                                id={card.id}
                                                className={`hover:bg-indigo-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors`}
                                                onClick={() => openEditModal('card', card)}
                                            >
                                                <td className="px-4 py-4">{card.issuer}</td>
                                                <td className="px-4 py-4 font-medium">
                                                     <div className="flex items-center gap-2">
                                                        {card.name}
                                                        {card.plaid_access_token ? (
                                                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">
                                                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                                                Live
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {card.last_plaid_sync && (
                                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal mt-0.5">
                                                            Synced {new Date(card.last_plaid_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 font-mono text-center">${card.credit_limit.toLocaleString('en-US', { minimumFractionDigits: 0 })}</td>
                                                <td className="px-4 py-4 font-mono text-center">${card.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-4 font-mono text-center">${card.payment_due.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-4 font-mono text-center">{formatDate(card.due_date)}</td>
                                                <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => togglePaid('card', card.id, card.paid)}
                                                        disabled={savingId === card.id}
                                                        className="cursor-pointer hover:scale-110 transition-transform disabled:opacity-50"
                                                    >
                                                        {savingId === card.id ? (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse">
                                                                <span className="text-gray-400 text-xs">...</span>
                                                            </span>
                                                        ) : card.paid ? (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 dark:bg-emerald-500/20 rounded-full">
                                                                <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full">
                                                                <span className="text-gray-400 text-xs">○</span>
                                                            </span>
                                                        )}
                                                    </button>
                                                </td>
                                            </SortableRow>
                                        ))}
                                    </SortableContext>
                                </tbody>
                            </table>
                        </DndContext>
                    </div>
                </section>

                {/* Bills Section */}
                <section>
                    <div className="flex justify-between items-center mb-6 pl-2 border-l-4 border-indigo-500">
                        <h2 className="text-2xl font-extrabold tracking-tight ml-2">Bills</h2>
                        <div className="flex gap-4">
                            <button
                                onClick={syncBillDates}
                                className="bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide shadow-lg shadow-indigo-500/30 transition-all"
                            >
                                Sync Bill Dates
                            </button>
                            <button
                                onClick={uncheckAllBills}
                                className="bg-red-600/90 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide shadow-lg shadow-red-500/30 transition-all"
                            >
                                Uncheck All Paid
                            </button>
                            <button onClick={addNewBill} className="flex items-center bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/30">
                                <Plus className="w-4 h-4 mr-2" /> Add Bill
                            </button>
                        </div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50 rounded-[2rem] shadow-xl overflow-hidden mt-4 mb-24">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, bills, setBills, 'bills')}>
                            <table className="w-full text-base text-left">
                                <thead className="bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                                    <tr>
                                        <th className="px-2 py-4 w-10"></th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Category</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Provider</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Freq</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Amount</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Date</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Source</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">Paid</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    <SortableContext items={bills.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                        {bills.map((bill) => {
                                            // Source badge colors
                                            const getSourceBadge = (source: string | null) => {
                                                const colors: Record<string, string> = {
                                                    'BofA': 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
                                                    'Truist': 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
                                                    'Quicksilver': 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
                                                    'Apple Card': 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300',
                                                    'Venture One': 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
                                                    'State Farm': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
                                                    'Discover': 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
                                                    'Barclays': 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
                                                    'World Elite': 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
                                                    'Chase Freedom': 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
                                                    'Robinhood': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                                                    'BMO': 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
                                                };
                                                if (!source) return null;
                                                const colorClass = colors[source] || 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400';
                                                return (
                                                    <span className={`text-xs px-2 py-1 ${colorClass} rounded-full font-medium whitespace-nowrap`}>
                                                        {source}
                                                    </span>
                                                );
                                            };

                                            return (
                                                <SortableRow
                                                    key={bill.id}
                                                    id={bill.id}
                                                    className={`hover:bg-indigo-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors`}
                                                    onClick={() => openEditModal('bill', bill)}
                                                >
                                                    <td className="px-4 py-4 text-sm">{bill.category}</td>
                                                    <td className="px-4 py-4 font-medium">{bill.name}</td>
                                                    <td className="px-4 py-4">
                                                        {(() => {
                                                            const freqColors: Record<string, string> = {
                                                                'Monthly': 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
                                                                'Weekly': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                                                                'Yearly': 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
                                                                'Biannual': 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
                                                            };
                                                            const colorClass = freqColors[bill.frequency] || 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400';
                                                            return (
                                                                <span className={`text-xs px-2 py-1 ${colorClass} rounded-full font-medium`}>
                                                                    {bill.frequency}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-4 py-4 font-mono text-center">${bill.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-4 font-mono text-center">{formatDate(bill.due_date)}</td>
                                                    <td className="px-4 py-4 text-center">{getSourceBadge(bill.source) || <span className="text-gray-400">—</span>}</td>
                                                    <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => togglePaid('bill', bill.id, bill.paid)}
                                                            disabled={savingId === bill.id}
                                                            className="cursor-pointer hover:scale-110 transition-transform disabled:opacity-50"
                                                        >
                                                            {savingId === bill.id ? (
                                                                <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse">
                                                                    <span className="text-gray-400 text-xs">...</span>
                                                                </span>
                                                            ) : bill.paid ? (
                                                                <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 dark:bg-emerald-500/20 rounded-full">
                                                                    <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full">
                                                                    <span className="text-gray-400 text-xs">○</span>
                                                                </span>
                                                            )}
                                                        </button>
                                                    </td>
                                                </SortableRow>
                                            );
                                        })}
                                    </SortableContext>
                                </tbody>
                            </table>
                        </DndContext>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default Admin;
