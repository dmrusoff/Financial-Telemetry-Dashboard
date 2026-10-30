import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { supabase } from '../lib/supabase';
import { Link2, RefreshCw, Loader2, X, CheckCircle2, Link as LinkIcon } from 'lucide-react';

interface PlaidLinkProps {
    onSuccess: () => void;
    table: 'banking' | 'credit_cards' | 'investments';
    targetLocalId?: string; // If linking a specific row
    targetLocalName?: string;
    variant?: 'button' | 'icon' | 'card';
}

// Helper: determine which dashboard table a Plaid account likely belongs to
function detectTable(plaidAcc: any): 'banking' | 'credit_cards' | 'investments' {
    const type = plaidAcc.type?.toLowerCase() || '';
    const subtype = plaidAcc.subtype?.toLowerCase() || '';
    if (type === 'credit' || subtype === 'credit card') return 'credit_cards';
    if (type === 'investment' || type === 'brokerage' || subtype === 'brokerage' || subtype === '401k' || subtype === 'ira' || subtype === 'roth') return 'investments';
    return 'banking';
}

const TABLE_LABELS: Record<string, string> = {
    banking: '🏦 Banking',
    credit_cards: '💳 Credit Cards',
    investments: '📈 Investments',
};

export const PlaidLink: React.FC<PlaidLinkProps> = ({ onSuccess, table, targetLocalId, targetLocalName, variant = 'button' }) => {
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // Mapping Modal State
    const [pendingAccounts, setPendingAccounts] = useState<any[]>([]);
    // All local accounts grouped by table
    const [allLocalAccounts, setAllLocalAccounts] = useState<Record<string, any[]>>({
        banking: [],
        credit_cards: [],
        investments: [],
    });
    // Per-plaid-account table override: plaid_account_id -> table name
    const [tableOverrides, setTableOverrides] = useState<Record<string, string>>({});
    const [mappings, setMappings] = useState<Record<string, string>>({}); // plaid_id -> local_id
    const [plaidInfo, setPlaidInfo] = useState<any>(null);

    const generateToken = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/plaid/create-link-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table }),
            });
            const data = await response.json();
            setLinkToken(data.link_token);
        } catch (error) {
            console.error('Error generating link token:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAllLocalAccounts = async () => {
        const [banking, cards, investments] = await Promise.all([
            supabase.from('banking').select('id, name, bank' as any).order('name'),
            supabase.from('credit_cards').select('id, name, issuer' as any).order('name'),
            supabase.from('investments').select('id, type, brokerage' as any).order('type'),
        ]);
        setAllLocalAccounts({
            banking: banking.data || [],
            credit_cards: cards.data || [],
            investments: investments.data || [],
        });
    };

    const handleOnSuccess = useCallback(async (public_token: string, metadata: any) => {
        setIsLoading(true);
        try {
            const exchangeResponse = await fetch('/api/plaid/exchange-public-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_token }),
            });
            const { access_token, item_id } = await exchangeResponse.json();

            const balanceResponse = await fetch('/api/plaid/get-balances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token }),
            });
            const balanceData = await balanceResponse.json();

            // Store info for mapping
            setPlaidInfo({ access_token, item_id, institution: metadata.institution });
            
            // If we have a targetLocalId (linked from a specific row) and exactly 1 account is returned, skip the modal and auto-link
            if (targetLocalId && balanceData.accounts.length === 1) {
                const plaidAcc = balanceData.accounts[0];
                const updateData: any = {
                    plaid_access_token: access_token,
                    plaid_item_id: item_id,
                    plaid_account_id: plaidAcc.account_id,
                    last_plaid_sync: new Date().toISOString()
                };

                // Table-specific balance fields
                if (table === 'banking' || table === 'investments') {
                    updateData.balance = plaidAcc.balances.current;
                } else {
                    updateData.current_balance = plaidAcc.balances.current;
                }

                await supabase.from(table).update(updateData).eq('id', targetLocalId);
                
                setIsLoading(false);
                onSuccess();
                return;
            }

            // Auto-detect table for each Plaid account
            const overrides: Record<string, string> = {};
            const enrichedAccounts = balanceData.accounts.map((acc: any) => {
                overrides[acc.account_id] = detectTable(acc);
                return {
                    ...acc,
                    plaidInfo: { access_token, item_id, institution: metadata.institution }
                };
            });
            setTableOverrides(overrides);

            setPendingAccounts(enrichedAccounts);
            await fetchAllLocalAccounts();
            setIsLoading(false);
        } catch (error) {
            console.error('Error in Plaid success handler:', error);
            setIsLoading(false);
        }
    }, [table, targetLocalId, onSuccess]);

    const confirmMapping = async () => {
        setIsLoading(true);
        try {
            for (const plaidAcc of pendingAccounts) {
                const localId = mappings[plaidAcc.account_id];
                const targetTable = (tableOverrides[plaidAcc.account_id] || table) as 'banking' | 'credit_cards' | 'investments';
                
                const updateData: any = {
                    name: plaidAcc.name,
                    plaid_access_token: plaidAcc.plaidInfo.access_token,
                    plaid_item_id: plaidAcc.plaidInfo.item_id,
                    plaid_account_id: plaidAcc.account_id,
                    last_plaid_sync: new Date().toISOString()
                };

                if (targetTable === 'banking') {
                    updateData.bank = plaidAcc.plaidInfo.institution.name;
                    updateData.balance = plaidAcc.balances.current;
                } else if (targetTable === 'investments') {
                    delete updateData.name;
                    updateData.brokerage = plaidAcc.plaidInfo.institution.name;
                    updateData.balance = plaidAcc.balances.current;
                } else {
                    updateData.issuer = plaidAcc.plaidInfo.institution.name;
                    updateData.current_balance = plaidAcc.balances.current;
                }
                
                if (localId === 'NEW') {
                    const { data: lastItem } = await supabase.from(targetTable).select('sort_order').order('sort_order', { ascending: false }).limit(1);
                    updateData.sort_order = (lastItem?.[0]?.sort_order || 0) + 1;
                    if (targetTable === 'investments') updateData.type = plaidAcc.name || plaidAcc.subtype || 'Investment';
                    await supabase.from(targetTable).insert(updateData);
                } else if (localId && localId !== 'SKIP') {
                    await supabase.from(targetTable).update(updateData).eq('id', localId);
                }
            }
            setPendingAccounts([]);
            setTableOverrides({});
            setMappings({});
            onSuccess();
        } catch (error) {
            console.error('Mapping Error:', error);
            alert('Error saving accounts. See console for details.');
        } finally {
            setIsLoading(false);
        }
    };

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: handleOnSuccess,
    });

    useEffect(() => {
        if (linkToken && ready) {
            open();
            setLinkToken(null);
        }
    }, [linkToken, ready, open]);

    return (
        <>
            {variant === 'button' ? (
                <button
                    onClick={(e) => { e.stopPropagation(); generateToken(); }}
                    disabled={isLoading}
                    className="flex items-center bg-emerald-600/90 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                    {targetLocalName ? `Link ${targetLocalName}` : 'Link with Plaid'}
                </button>
            ) : variant === 'card' ? (
                <button
                    onClick={(e) => { e.stopPropagation(); generateToken(); }}
                    disabled={isLoading}
                    className="w-full bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-white/5 p-6 rounded-[2rem] shadow-lg hover:shadow-xl hover:bg-white dark:hover:bg-slate-800 transition-all text-left flex flex-col justify-between h-full group disabled:opacity-50"
                >
                    <div className="flex items-center gap-2 mb-2 w-full justify-between">
                         <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover:animate-pulse" />
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Add Account</span>
                         </div>
                         {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <LinkIcon className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors" />}
                    </div>
                    <div className="flex items-baseline gap-2 mt-4 cursor-pointer">
                        <span className="text-3xl font-black text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {isLoading ? '...' : 'Link'}
                        </span>
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-tighter">With Plaid</span>
                    </div>
                </button>
            ) : (
                <button
                    onClick={(e) => { e.stopPropagation(); generateToken(); }}
                    disabled={isLoading}
                    className={`p-2 rounded-lg transition-all ${isLoading ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-600'}`}
                    title="Connect to Plaid"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <LinkIcon className="w-4 h-4" />}
                </button>
            )}

            {/* Mapping Modal */}
            {pendingAccounts.length > 0 && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-emerald-50/30 dark:bg-emerald-500/5">
                            <div>
                                <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Mapping: {plaidInfo?.institution?.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Connect discovered accounts to your dashboard</p>
                            </div>
                            <button onClick={() => { setPendingAccounts([]); setTableOverrides({}); setMappings({}); }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-6">
                            {pendingAccounts.map((pAcc) => {
                                const detectedTable = tableOverrides[pAcc.account_id] || table;
                                const accountsForTable = allLocalAccounts[detectedTable] || [];
                                
                                return (
                                    <div key={pAcc.account_id} className="group relative bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 p-5 rounded-3xl transition-all hover:border-emerald-500/30 hover:bg-white dark:hover:bg-slate-700/50">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                        {pAcc.type} · {pAcc.subtype}
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{pAcc.name}</div>
                                                    <div className="text-sm font-mono text-gray-400 mt-1 flex items-center gap-2">
                                                        <span>•••• {pAcc.mask || 'XXXX'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                                        <span className="text-emerald-600/80 dark:text-emerald-400/80 font-bold">${pAcc.balances.current?.toLocaleString() || '0'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Category + Mapping Row */}
                                            <div className="flex flex-col md:flex-row gap-3">
                                                {/* Table/Category Selector */}
                                                <div className="md:w-48">
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Category</label>
                                                    <select
                                                        value={detectedTable}
                                                        onChange={(e) => {
                                                            setTableOverrides({ ...tableOverrides, [pAcc.account_id]: e.target.value });
                                                            // Clear mapping when table changes
                                                            const newMappings = { ...mappings };
                                                            delete newMappings[pAcc.account_id];
                                                            setMappings(newMappings);
                                                        }}
                                                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="banking">{TABLE_LABELS.banking}</option>
                                                        <option value="credit_cards">{TABLE_LABELS.credit_cards}</option>
                                                        <option value="investments">{TABLE_LABELS.investments}</option>
                                                    </select>
                                                </div>
                                                
                                                {/* Account Mapping Selector */}
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Map to Dashboard</label>
                                                    <select 
                                                        value={mappings[pAcc.account_id] || ''}
                                                        onChange={(e) => setMappings({ ...mappings, [pAcc.account_id]: e.target.value })}
                                                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="">Select an option...</option>
                                                        <option value="NEW">+ Create as New Account</option>
                                                        <option value="SKIP">Skip / Ignore</option>
                                                        {accountsForTable.length > 0 && (
                                                            <optgroup label={`Existing ${TABLE_LABELS[detectedTable]} Accounts`}>
                                                                {accountsForTable.map((lAcc: any) => (
                                                                    <option key={lAcc.id} value={lAcc.id}>
                                                                        {lAcc.bank || lAcc.brokerage || lAcc.issuer} - {lAcc.name || lAcc.type}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-black/10 flex justify-end gap-3">
                            <button 
                                onClick={() => { setPendingAccounts([]); setTableOverrides({}); setMappings({}); }}
                                className="px-6 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmMapping}
                                disabled={isLoading || Object.keys(mappings).length === 0}
                                className="px-8 py-3 rounded-2xl text-sm font-black bg-emerald-600 text-white hover:bg-emerald-500 shadow-xl shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Confirm Mapping
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export const SyncPlaidBalances: React.FC<{ onSuccess: () => void, variant?: 'button' | 'card' }> = ({ onSuccess, variant = 'button' }) => {
    const [isSyncing, setIsSyncing] = useState(false);

    const syncAll = async () => {
        setIsSyncing(true);
        try {
            const { data: banking } = await supabase.from('banking').select('*').not('plaid_access_token', 'is', null);
            const { data: cards } = await supabase.from('credit_cards').select('*').not('plaid_access_token', 'is', null);
            const { data: investments } = await supabase.from('investments').select('*').not('plaid_access_token', 'is', null);

            const allToSync = [
                ...(banking || []).map(a => ({ ...a, table: 'banking' })),
                ...(cards || []).map(c => ({ ...c, table: 'credit_cards' })),
                ...(investments || []).map(i => ({ ...i, table: 'investments' }))
            ];

            const uniqueTokens = Array.from(new Set(allToSync.map(a => a.plaid_access_token)));

            for (const token of uniqueTokens) {
                const response = await fetch('/api/plaid/get-balances', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: token }),
                });
                const data = await response.json();
                
                for (const plaidAcc of data.accounts) {
                    const localAcc = allToSync.find(a => a.plaid_account_id === plaidAcc.account_id);
                    if (localAcc) {
                        const updateData: any = {
                            last_plaid_sync: new Date().toISOString()
                        };

                        if (localAcc.table === 'banking' || localAcc.table === 'investments') {
                            updateData.balance = plaidAcc.balances.current;
                        } else {
                            updateData.current_balance = plaidAcc.balances.current;
                        }

                        await supabase
                            .from(localAcc.table)
                            .update(updateData)
                            .eq('id', localAcc.id);
                    }
                }
            }
            onSuccess();
        } catch (error) {
            console.error('Sync Error:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    return variant === 'card' ? (
        <button
            onClick={syncAll}
            disabled={isSyncing}
            className="w-full bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-white/5 p-6 rounded-[2rem] shadow-lg hover:shadow-xl hover:bg-white dark:hover:bg-slate-800 transition-all text-left flex flex-col justify-between h-full group disabled:opacity-50"
        >
            <div className="flex items-center gap-2 mb-2 w-full justify-between">
                 <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)] group-hover:animate-pulse" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">Plaid Sync</span>
                 </div>
                 {isSyncing ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <RefreshCw className="w-5 h-5 text-gray-400 group-hover:text-sky-500 transition-colors" />}
            </div>
            <div className="flex items-baseline gap-2 mt-4 cursor-pointer">
                <span className="text-3xl font-black text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {isSyncing ? '...' : 'Sync'}
                </span>
                <span className="text-sm font-bold text-gray-400 uppercase tracking-tighter">Balances</span>
            </div>
        </button>
    ) : (
        <button
            onClick={syncAll}
            disabled={isSyncing}
            className="flex items-center bg-indigo-600/90 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50"
            title="Sync all Plaid-linked accounts"
        >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Balances'}
        </button>
    );
};

export const ManagePlaidConnections: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAccounts, setPendingAccounts] = useState<any[]>([]);
    const [allLocalAccounts, setAllLocalAccounts] = useState<Record<string, any[]>>({ banking: [], credit_cards: [], investments: [] });
    const [tableOverrides, setTableOverrides] = useState<Record<string, string>>({});
    const [mappings, setMappings] = useState<Record<string, string>>({});

    const fetchAllLocalAccounts = async () => {
        const [banking, cards, investments] = await Promise.all([
            supabase.from('banking').select('id, name, bank' as any).order('name'),
            supabase.from('credit_cards').select('id, name, issuer' as any).order('name'),
            supabase.from('investments').select('id, type, brokerage' as any).order('type'),
        ]);
        setAllLocalAccounts({
            banking: banking.data || [],
            credit_cards: cards.data || [],
            investments: investments.data || [],
        });
    };

    const confirmMapping = async () => {
        setIsLoading(true);
        try {
            for (const plaidAcc of pendingAccounts) {
                const localId = mappings[plaidAcc.account_id];
                const targetTable = (tableOverrides[plaidAcc.account_id] || 'banking') as 'banking' | 'credit_cards' | 'investments';
                
                // Only process mapped selected accounts
                if (!localId || localId === '') continue;

                const updateData: any = {
                    name: plaidAcc.name,
                    plaid_access_token: plaidAcc.plaidInfo.access_token,
                    plaid_item_id: plaidAcc.plaidInfo.item_id,
                    plaid_account_id: plaidAcc.account_id,
                    last_plaid_sync: new Date().toISOString()
                };

                if (targetTable === 'banking') {
                    updateData.bank = plaidAcc.plaidInfo.institution.name;
                    updateData.balance = plaidAcc.balances.current;
                } else if (targetTable === 'investments') {
                    delete updateData.name;
                    updateData.brokerage = plaidAcc.plaidInfo.institution.name;
                    updateData.balance = plaidAcc.balances.current;
                } else {
                    updateData.issuer = plaidAcc.plaidInfo.institution.name;
                    updateData.current_balance = plaidAcc.balances.current;
                }
                
                if (localId === 'NEW') {
                    const { data: lastItem } = await supabase.from(targetTable).select('sort_order').order('sort_order', { ascending: false }).limit(1);
                    updateData.sort_order = (lastItem?.[0]?.sort_order || 0) + 1;
                    if (targetTable === 'investments') updateData.type = plaidAcc.name || plaidAcc.subtype || 'Investment';
                    await supabase.from(targetTable).insert(updateData);
                } else if (localId !== 'SKIP') {
                    await supabase.from(targetTable).update(updateData).eq('id', localId);
                }
            }
            setPendingAccounts([]);
            setTableOverrides({});
            setMappings({});
            onSuccess();
        } catch (error) {
            console.error('Mapping Error:', error);
            alert('Error saving accounts. See console for details.');
        } finally {
            setIsLoading(false);
        }
    };

    const openManager = async () => {
        setIsLoading(true);
        try {
            const { data: banking } = await supabase.from('banking').select('bank, plaid_access_token, plaid_item_id').not('plaid_access_token', 'is', null);
            const { data: cards } = await supabase.from('credit_cards').select('issuer, plaid_access_token, plaid_item_id').not('plaid_access_token', 'is', null);
            const { data: investments } = await supabase.from('investments').select('brokerage, plaid_access_token, plaid_item_id').not('plaid_access_token', 'is', null);

            const tokenMap = new Map();
            [...(banking || []).map((a: any) => ({ token: a.plaid_access_token, name: a.bank, item: a.plaid_item_id })), 
             ...(cards || []).map((c: any) => ({ token: c.plaid_access_token, name: c.issuer, item: c.plaid_item_id })),
             ...(investments || []).map((i: any) => ({ token: i.plaid_access_token, name: i.brokerage, item: i.plaid_item_id }))]
            .forEach(item => {
                if (!tokenMap.has(item.token)) tokenMap.set(item.token, { name: item.name, item_id: item.item });
            });

            let combinedAccounts: any[] = [];
            const overrides: Record<string, string> = {};

            for (const [token, info] of Array.from(tokenMap.entries())) {
                const response = await fetch('/api/plaid/get-balances', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: token }),
                });
                const data = await response.json();
                if (data.accounts) {
                    for (const acc of data.accounts) {
                        overrides[acc.account_id] = detectTable(acc);
                        combinedAccounts.push({
                            ...acc,
                            plaidInfo: { access_token: token, item_id: info.item_id, institution: { name: info.name } }
                        });
                    }
                }
            }
            
            setTableOverrides(overrides);
            setPendingAccounts(combinedAccounts);
            await fetchAllLocalAccounts();
        } catch (error) {
            console.error('Error opening Plaid manager', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={openManager}
                disabled={isLoading}
                className="w-full bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-100 dark:border-white/5 p-6 rounded-[2rem] shadow-lg hover:shadow-xl hover:bg-white dark:hover:bg-slate-800 transition-all text-left flex flex-col justify-between h-full group disabled:opacity-50"
            >
                <div className="flex items-center gap-2 mb-2 w-full justify-between">
                     <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] group-hover:animate-pulse" />
                         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Plaid Mapping</span>
                     </div>
                     {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <LinkIcon className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />}
                </div>
                <div className="flex items-baseline gap-2 mt-4 cursor-pointer">
                    <span className="text-3xl font-black text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {isLoading ? '...' : 'Manage'}
                    </span>
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-tighter">Connections</span>
                </div>
            </button>

            {pendingAccounts.length > 0 && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-slate-50/30 dark:bg-white/5">
                            <div>
                                <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Active Plaid Connections</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and manage your linked accounts</p>
                            </div>
                            <button onClick={() => { setPendingAccounts([]); setTableOverrides({}); setMappings({}); }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-6">
                            {pendingAccounts.map((pAcc) => {
                                const detectedTable = tableOverrides[pAcc.account_id] || 'banking';
                                const accountsForTable = allLocalAccounts[detectedTable] || [];
                                
                                return (
                                    <div key={pAcc.account_id} className="group relative bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 p-5 rounded-3xl transition-all hover:border-slate-500/30 hover:bg-white dark:hover:bg-slate-700/50">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        {pAcc.plaidInfo?.institution?.name} · {pAcc.type} · {pAcc.subtype}
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{pAcc.name}</div>
                                                    <div className="text-sm font-mono text-gray-400 mt-1 flex items-center gap-2">
                                                        <span>•••• {pAcc.mask || 'XXXX'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                                        <span className="text-slate-600 dark:text-slate-400 font-bold">${pAcc.balances.current?.toLocaleString() || '0'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <div className="md:w-48">
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Category</label>
                                                    <select
                                                        value={detectedTable}
                                                        onChange={(e) => {
                                                            setTableOverrides({ ...tableOverrides, [pAcc.account_id]: e.target.value });
                                                            const newMappings = { ...mappings };
                                                            delete newMappings[pAcc.account_id];
                                                            setMappings(newMappings);
                                                        }}
                                                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-slate-500/20 outline-none transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="banking">{TABLE_LABELS.banking}</option>
                                                        <option value="credit_cards">{TABLE_LABELS.credit_cards}</option>
                                                        <option value="investments">{TABLE_LABELS.investments}</option>
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Map to Dashboard</label>
                                                    <select 
                                                        value={mappings[pAcc.account_id] || ''}
                                                        onChange={(e) => setMappings({ ...mappings, [pAcc.account_id]: e.target.value })}
                                                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-slate-500/20 outline-none transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="">Keep current mapping (unchanged)</option>
                                                        <option value="NEW">+ Create as New Account</option>
                                                        <option value="SKIP">Skip / Ignore</option>
                                                        {accountsForTable.length > 0 && (
                                                            <optgroup label={`Existing ${TABLE_LABELS[detectedTable]} Accounts`}>
                                                                {accountsForTable.map((lAcc: any) => (
                                                                    <option key={lAcc.id} value={lAcc.id}>
                                                                        {lAcc.bank || lAcc.brokerage || lAcc.issuer} - {lAcc.name || lAcc.type}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-black/10 flex justify-end gap-3">
                            <button 
                                onClick={() => { setPendingAccounts([]); setTableOverrides({}); setMappings({}); }}
                                className="px-6 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmMapping}
                                disabled={isLoading || Object.keys(mappings).length === 0}
                                className="px-8 py-3 rounded-2xl text-sm font-black bg-slate-800 text-white hover:bg-slate-700 shadow-xl shadow-black/10 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Update Mappings
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
