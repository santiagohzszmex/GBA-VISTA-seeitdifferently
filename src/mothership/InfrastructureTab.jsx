import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Banknote,
  CircleDollarSign,
  Cpu,
  HardDrive,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Wallet,
  WifiOff
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const AREA_OPTIONS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'ledger', label: 'Money', icon: Banknote },
  { id: 'assets', label: 'Assets', icon: HardDrive },
  { id: 'nodes', label: 'Nodes', icon: Server }
];

const ENTRY_LABELS = {
  contribution: 'Aportación',
  income: 'Ingreso',
  expense: 'Gasto'
};

const OWNERSHIP_LABELS = {
  personal_assigned: 'Personal asignado a GBA',
  gba_owned: 'Propiedad de GBA',
  borrowed: 'Prestado'
};

const NODE_STATUS_LABELS = {
  planned: 'Planeado',
  offline: 'Fuera de línea',
  online: 'En línea',
  maintenance: 'Mantenimiento',
  retired: 'Retirado'
};

const ASSET_STATUS_LABELS = {
  planned: 'Planeado',
  testing: 'En pruebas',
  active: 'Activo',
  maintenance: 'Mantenimiento',
  retired: 'Retirado'
};

const today = () => {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};
const formatMoney = (amount, currency = 'MXN') => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2
}).format(Number(amount) || 0);

const initialEntry = {
  account_id: '',
  asset_id: '',
  entry_type: 'contribution',
  amount: '',
  entry_date: today(),
  concept: '',
  counterparty: '',
  payment_method: 'Transferencia',
  reimbursable: false,
  notes: ''
};

const initialAsset = {
  asset_code: '',
  name: '',
  asset_type: 'computer',
  ownership: 'personal_assigned',
  status: 'planned',
  acquisition_date: '',
  acquisition_cost: '',
  currency: 'MXN',
  owner_name: '',
  assigned_project: 'GBA Infrastructure',
  serial_number: '',
  notes: ''
};

const initialNode = {
  node_code: '',
  name: '',
  codename: '',
  asset_id: '',
  status: 'planned',
  environment: 'lab',
  purpose: '',
  hostname: ''
};

function FieldLabel({ children }) {
  return <span className="block text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">{children}</span>;
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="min-h-44 border-y border-dashed border-white/10 flex flex-col items-center justify-center text-center px-6">
      <Icon size={26} className="text-neutral-600 mb-3"/>
      <p className="font-bold text-sm text-neutral-300">{title}</p>
      <p className="text-xs text-neutral-500 mt-1 max-w-md">{description}</p>
    </div>
  );
}

export default function InfrastructureTab() {
  const { user } = useAuth();
  const [activeArea, setActiveArea] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [assets, setAssets] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [entryForm, setEntryForm] = useState(initialEntry);
  const [assetForm, setAssetForm] = useState(initialAsset);
  const [nodeForm, setNodeForm] = useState(initialNode);

  const loadInfrastructure = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    const [accountsResult, entriesResult, assetsResult, nodesResult] = await Promise.all([
      supabase.from('gba_budget_accounts').select('*').order('created_at'),
      supabase.from('gba_finance_entries').select('*, gba_budget_accounts(code,name,currency), gba_assets(asset_code,name)').order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('gba_assets').select('*').order('created_at', { ascending: false }),
      supabase.from('gba_nodes').select('*, gba_assets(asset_code,name)').order('created_at')
    ]);

    const error = accountsResult.error || entriesResult.error || assetsResult.error || nodesResult.error;
    if (error) {
      console.warn('Infrastructure load unavailable:', error);
      setNotice({ type: 'error', message: 'Infrastructure todavía no está disponible. Ejecuta la migración 202607270001_gba_infrastructure.sql.' });
    } else {
      setAccounts(accountsResult.data || []);
      setEntries(entriesResult.data || []);
      setAssets(assetsResult.data || []);
      setNodes(nodesResult.data || []);
      setEntryForm(current => ({ ...current, account_id: current.account_id || accountsResult.data?.[0]?.id || '' }));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInfrastructure();
  }, []);

  const accountSummaries = useMemo(() => accounts.map(account => {
    const accountEntries = entries.filter(entry => entry.account_id === account.id);
    const contributed = accountEntries
      .filter(entry => entry.entry_type === 'contribution')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const income = accountEntries
      .filter(entry => entry.entry_type === 'income')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const spent = accountEntries
      .filter(entry => entry.entry_type === 'expense')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const available = contributed + income - spent;
    const progress = Number(account.target_amount) > 0
      ? Math.min(100, Math.max(0, (available / Number(account.target_amount)) * 100))
      : 0;
    return { ...account, contributed, income, spent, available, progress };
  }), [accounts, entries]);

  const persist = async (operation, successMessage) => {
    setSaving(true);
    setNotice(null);
    try {
      const { error } = await operation();
      if (error) throw error;
      setNotice({ type: 'success', message: successMessage });
      await loadInfrastructure(false);
      return true;
    } catch (error) {
      console.error(error);
      setNotice({ type: 'error', message: error.message || 'No fue posible guardar el registro.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitEntry = async (event) => {
    event.preventDefault();
    const payload = {
      ...entryForm,
      asset_id: entryForm.asset_id || null,
      amount: Number(entryForm.amount),
      counterparty: entryForm.counterparty || null,
      payment_method: entryForm.payment_method || null,
      notes: entryForm.notes || null,
      created_by: user.id
    };
    const saved = await persist(
      () => supabase.from('gba_finance_entries').insert(payload),
      'Movimiento financiero registrado.'
    );
    if (saved) setEntryForm(current => ({ ...initialEntry, account_id: current.account_id, entry_date: today() }));
  };

  const submitAsset = async (event) => {
    event.preventDefault();
    const payload = {
      ...assetForm,
      acquisition_date: assetForm.acquisition_date || null,
      acquisition_cost: Number(assetForm.acquisition_cost) || 0,
      owner_name: assetForm.owner_name || null,
      assigned_project: assetForm.assigned_project || null,
      serial_number: assetForm.serial_number || null,
      notes: assetForm.notes || null,
      created_by: user.id
    };
    const saved = await persist(
      () => supabase.from('gba_assets').insert(payload),
      'Activo registrado en el inventario de GBA.'
    );
    if (saved) setAssetForm(initialAsset);
  };

  const submitNode = async (event) => {
    event.preventDefault();
    const payload = {
      ...nodeForm,
      asset_id: nodeForm.asset_id || null,
      codename: nodeForm.codename || null,
      purpose: nodeForm.purpose || null,
      hostname: nodeForm.hostname || null,
      created_by: user.id
    };
    const saved = await persist(
      () => supabase.from('gba_nodes').insert(payload),
      'Nodo añadido al control plane.'
    );
    if (saved) setNodeForm(initialNode);
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm(`¿Eliminar el movimiento "${entry.concept}"?`)) return;
    await persist(
      () => supabase.from('gba_finance_entries').delete().eq('id', entry.id),
      'Movimiento eliminado.'
    );
  };

  const updateNodeStatus = async (node, status) => {
    await persist(
      () => supabase.from('gba_nodes').update({ status, updated_at: new Date().toISOString() }).eq('id', node.id),
      `${node.name} actualizado.`
    );
  };

  const renderOverview = () => (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4da3ff]">Capital allocation</p>
            <h3 className="text-2xl font-serif italic font-bold mt-1">Presupuestos de GBA</h3>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">MXN y USD se mantienen separados</span>
        </div>
        <div className="grid md:grid-cols-3 border-y border-white/10 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {accountSummaries.map(account => (
            <div key={account.id} className="py-6 md:px-6 first:pl-0 last:pr-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">{account.code}</p>
                  <h4 className="font-bold mt-1">{account.name}</h4>
                </div>
                <Wallet size={17} className="text-[#4da3ff]"/>
              </div>
              <p className="text-2xl font-bold tabular-nums mt-5">{formatMoney(account.available, account.currency)}</p>
              <p className="text-[10px] text-neutral-500 mt-1">Disponible · Meta {formatMoney(account.target_amount, account.currency)}</p>
              <div className="h-1 bg-white/10 mt-4 overflow-hidden">
                <div className="h-full bg-[#0066FF]" style={{ width: `${account.progress}%` }}/>
              </div>
              <div className="flex justify-between mt-3 text-[10px] text-neutral-500">
                <span>Ingresó {formatMoney(account.contributed + account.income, account.currency)}</span>
                <span>Gastado {formatMoney(account.spent, account.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-5">
          <Server size={17} className="text-[#4da3ff]"/>
          <h3 className="text-sm font-black uppercase tracking-widest">Infrastructure nodes</h3>
        </div>
        {nodes.length === 0 ? (
          <EmptyState icon={WifiOff} title="No hay nodos registrados" description="El primer nodo puede permanecer como planeado hasta que exista físicamente."/>
        ) : (
          <div className="border-y border-white/10 divide-y divide-white/10">
            {nodes.map(node => (
              <div key={node.id} className="grid md:grid-cols-[minmax(0,1fr)_150px_180px] gap-4 items-center py-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold truncate">{node.name}</h4>
                    <span className="text-[8px] font-black uppercase tracking-wider text-[#4da3ff]">{node.codename || node.node_code}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{node.purpose || 'Sin función definida'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">Entorno</p>
                  <p className="text-xs font-bold uppercase mt-1">{node.environment}</p>
                </div>
                <div className="flex md:justify-end items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-green-400' : node.status === 'planned' ? 'bg-blue-400' : 'bg-neutral-600'}`}/>
                  <span className="text-xs font-bold">{NODE_STATUS_LABELS[node.status]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-5">
          <CircleDollarSign size={17} className="text-[#4da3ff]"/>
          <h3 className="text-sm font-black uppercase tracking-widest">Actividad reciente</h3>
        </div>
        {entries.length === 0 ? (
          <EmptyState icon={Banknote} title="Aún no hay dinero registrado" description="La primera compra se registra cuando ocurra; una negociación todavía no es un gasto."/>
        ) : (
          <LedgerRows entries={entries.slice(0, 6)} onDelete={deleteEntry}/>
        )}
      </section>
    </div>
  );

  const renderLedger = () => (
    <div className="grid xl:grid-cols-[340px_minmax(0,1fr)] gap-10">
      <form onSubmit={submitEntry} className="space-y-4 xl:border-r xl:border-white/10 xl:pr-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4da3ff]">New movement</p>
          <h3 className="text-2xl font-serif italic font-bold mt-1">Registrar dinero real</h3>
          <p className="text-xs text-neutral-500 mt-2">Las cantidades siempre se guardan como positivas; el tipo determina si entran o salen.</p>
        </div>
        <label><FieldLabel>Presupuesto</FieldLabel><select required value={entryForm.account_id} onChange={event => setEntryForm({ ...entryForm, account_id: event.target.value })} className="forge-input">{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label><FieldLabel>Tipo</FieldLabel><select value={entryForm.entry_type} onChange={event => setEntryForm({ ...entryForm, entry_type: event.target.value })} className="forge-input"><option value="contribution">Aportación</option><option value="income">Ingreso</option><option value="expense">Gasto</option></select></label>
          <label><FieldLabel>Cantidad</FieldLabel><input required min="0.01" step="0.01" type="number" value={entryForm.amount} onChange={event => setEntryForm({ ...entryForm, amount: event.target.value })} className="forge-input" placeholder="0.00"/></label>
        </div>
        <label><FieldLabel>Concepto</FieldLabel><input required value={entryForm.concept} onChange={event => setEntryForm({ ...entryForm, concept: event.target.value })} className="forge-input" placeholder="Compra, ahorro o ingreso"/></label>
        <div className="grid grid-cols-2 gap-3">
          <label><FieldLabel>Fecha</FieldLabel><input required type="date" value={entryForm.entry_date} onChange={event => setEntryForm({ ...entryForm, entry_date: event.target.value })} className="forge-input"/></label>
          <label><FieldLabel>Método</FieldLabel><input value={entryForm.payment_method} onChange={event => setEntryForm({ ...entryForm, payment_method: event.target.value })} className="forge-input"/></label>
        </div>
        <label><FieldLabel>Persona o proveedor</FieldLabel><input value={entryForm.counterparty} onChange={event => setEntryForm({ ...entryForm, counterparty: event.target.value })} className="forge-input" placeholder="Opcional"/></label>
        <label><FieldLabel>Activo relacionado</FieldLabel><select value={entryForm.asset_id} onChange={event => setEntryForm({ ...entryForm, asset_id: event.target.value })} className="forge-input"><option value="">Ninguno</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.asset_code} · {asset.name}</option>)}</select></label>
        <label className="min-h-11 flex items-center gap-3 border-y border-white/10 text-xs font-bold"><input type="checkbox" checked={entryForm.reimbursable} onChange={event => setEntryForm({ ...entryForm, reimbursable: event.target.checked })} className="accent-[#0066FF]"/> GBA debe reembolsar este pago</label>
        <button disabled={saving || accounts.length === 0} className="forge-primary" type="submit"><Plus size={16}/>Registrar movimiento</button>
      </form>
      <section>
        <h3 className="text-xl font-bold mb-5">Ledger</h3>
        {entries.length === 0 ? <EmptyState icon={Banknote} title="Ledger vacío" description="Las negociaciones no se registran hasta que el dinero realmente entra o sale."/> : <LedgerRows entries={entries} onDelete={deleteEntry}/>}
      </section>
    </div>
  );

  const renderAssets = () => (
    <div className="grid xl:grid-cols-[340px_minmax(0,1fr)] gap-10">
      <form onSubmit={submitAsset} className="space-y-4 xl:border-r xl:border-white/10 xl:pr-10">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4da3ff]">Asset registry</p><h3 className="text-2xl font-serif italic font-bold mt-1">Registrar activo</h3></div>
        <div className="grid grid-cols-2 gap-3">
          <label><FieldLabel>Código</FieldLabel><input required value={assetForm.asset_code} onChange={event => setAssetForm({ ...assetForm, asset_code: event.target.value.toUpperCase() })} className="forge-input" placeholder="GBA-AST-001"/></label>
          <label><FieldLabel>Tipo</FieldLabel><select value={assetForm.asset_type} onChange={event => setAssetForm({ ...assetForm, asset_type: event.target.value })} className="forge-input"><option value="computer">Computadora</option><option value="storage">Almacenamiento</option><option value="network">Red</option><option value="power">Energía</option><option value="other">Otro</option></select></label>
        </div>
        <label><FieldLabel>Nombre</FieldLabel><input required value={assetForm.name} onChange={event => setAssetForm({ ...assetForm, name: event.target.value })} className="forge-input" placeholder="Mac mini Late 2012"/></label>
        <label><FieldLabel>Propiedad</FieldLabel><select value={assetForm.ownership} onChange={event => setAssetForm({ ...assetForm, ownership: event.target.value })} className="forge-input"><option value="personal_assigned">Personal asignado a GBA</option><option value="gba_owned">Propiedad de GBA</option><option value="borrowed">Prestado</option></select></label>
        <div className="grid grid-cols-2 gap-3">
          <label><FieldLabel>Costo</FieldLabel><input min="0" step="0.01" type="number" value={assetForm.acquisition_cost} onChange={event => setAssetForm({ ...assetForm, acquisition_cost: event.target.value })} className="forge-input" placeholder="0.00"/></label>
          <label><FieldLabel>Moneda</FieldLabel><select value={assetForm.currency} onChange={event => setAssetForm({ ...assetForm, currency: event.target.value })} className="forge-input"><option value="MXN">MXN</option><option value="USD">USD</option></select></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label><FieldLabel>Fecha</FieldLabel><input type="date" value={assetForm.acquisition_date} onChange={event => setAssetForm({ ...assetForm, acquisition_date: event.target.value })} className="forge-input"/></label>
          <label><FieldLabel>Estado</FieldLabel><select value={assetForm.status} onChange={event => setAssetForm({ ...assetForm, status: event.target.value })} className="forge-input">{Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label><FieldLabel>Propietario</FieldLabel><input value={assetForm.owner_name} onChange={event => setAssetForm({ ...assetForm, owner_name: event.target.value })} className="forge-input" placeholder="Santiago / GBA"/></label>
        <label><FieldLabel>Proyecto asignado</FieldLabel><input value={assetForm.assigned_project} onChange={event => setAssetForm({ ...assetForm, assigned_project: event.target.value })} className="forge-input"/></label>
        <label><FieldLabel>Serie</FieldLabel><input value={assetForm.serial_number} onChange={event => setAssetForm({ ...assetForm, serial_number: event.target.value })} className="forge-input" placeholder="Se registra después de comprar"/></label>
        <button disabled={saving} className="forge-primary" type="submit"><Plus size={16}/>Añadir al inventario</button>
      </form>
      <section>
        <h3 className="text-xl font-bold mb-5">Inventario</h3>
        {assets.length === 0 ? <EmptyState icon={HardDrive} title="No hay activos" description="Registra el equipo únicamente después de cerrar la compra."/> : (
          <div className="border-y border-white/10 divide-y divide-white/10">
            {assets.map(asset => (
              <div key={asset.id} className="grid md:grid-cols-[minmax(0,1fr)_180px_130px] gap-4 py-5 items-center">
                <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-[#4da3ff]">{asset.asset_code}</p><h4 className="font-bold mt-1 truncate">{asset.name}</h4><p className="text-xs text-neutral-500 mt-1">{OWNERSHIP_LABELS[asset.ownership]}{asset.owner_name ? ` · ${asset.owner_name}` : ''}</p></div>
                <div><p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">Costo registrado</p><p className="font-bold tabular-nums mt-1">{formatMoney(asset.acquisition_cost, asset.currency)}</p></div>
                <div className="md:text-right"><p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">Estado</p><p className="text-xs font-bold mt-1">{ASSET_STATUS_LABELS[asset.status]}</p></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderNodes = () => (
    <div className="grid xl:grid-cols-[340px_minmax(0,1fr)] gap-10">
      <form onSubmit={submitNode} className="space-y-4 xl:border-r xl:border-white/10 xl:pr-10">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4da3ff]">Control plane</p><h3 className="text-2xl font-serif italic font-bold mt-1">Registrar nodo</h3></div>
        <div className="grid grid-cols-2 gap-3">
          <label><FieldLabel>Código</FieldLabel><input required value={nodeForm.node_code} onChange={event => setNodeForm({ ...nodeForm, node_code: event.target.value.toUpperCase() })} className="forge-input" placeholder="GBA-NODE-02"/></label>
          <label><FieldLabel>Entorno</FieldLabel><select value={nodeForm.environment} onChange={event => setNodeForm({ ...nodeForm, environment: event.target.value })} className="forge-input"><option value="lab">Lab</option><option value="staging">Staging</option><option value="production">Production</option><option value="backup">Backup</option></select></label>
        </div>
        <label><FieldLabel>Nombre</FieldLabel><input required value={nodeForm.name} onChange={event => setNodeForm({ ...nodeForm, name: event.target.value })} className="forge-input" placeholder="GBA Node 02"/></label>
        <label><FieldLabel>Codename</FieldLabel><input value={nodeForm.codename} onChange={event => setNodeForm({ ...nodeForm, codename: event.target.value })} className="forge-input"/></label>
        <label><FieldLabel>Activo físico</FieldLabel><select value={nodeForm.asset_id} onChange={event => setNodeForm({ ...nodeForm, asset_id: event.target.value })} className="forge-input"><option value="">Aún no asignado</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.asset_code} · {asset.name}</option>)}</select></label>
        <label><FieldLabel>Hostname</FieldLabel><input value={nodeForm.hostname} onChange={event => setNodeForm({ ...nodeForm, hostname: event.target.value })} className="forge-input" placeholder="gba-node-02"/></label>
        <label><FieldLabel>Función</FieldLabel><textarea required rows="4" value={nodeForm.purpose} onChange={event => setNodeForm({ ...nodeForm, purpose: event.target.value })} className="forge-input resize-none" placeholder="Responsabilidad técnica del nodo"/></label>
        <button disabled={saving} className="forge-primary" type="submit"><Plus size={16}/>Registrar nodo</button>
      </form>
      <section>
        <h3 className="text-xl font-bold mb-5">Node registry</h3>
        {nodes.length === 0 ? <EmptyState icon={Server} title="Sin nodos" description="El control plane está listo para el primer equipo."/> : (
          <div className="border-y border-white/10 divide-y divide-white/10">
            {nodes.map(node => (
              <div key={node.id} className="py-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                  <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-[#4da3ff]">{node.node_code} · {node.environment}</p><h4 className="font-serif italic text-2xl font-bold mt-1">{node.name}{node.codename ? `: ${node.codename}` : ''}</h4><p className="text-sm text-neutral-400 mt-2 max-w-2xl">{node.purpose}</p><p className="text-[10px] text-neutral-600 mt-3">Activo: {node.gba_assets?.name || 'Sin hardware asignado'} · Heartbeat: {node.last_heartbeat ? new Date(node.last_heartbeat).toLocaleString('es-MX') : 'No disponible'}</p></div>
                  <label className="w-full md:w-48 flex-shrink-0"><FieldLabel>Estado operativo</FieldLabel><select value={node.status} onChange={event => updateNodeStatus(node, event.target.value)} className="forge-input">{Object.entries(NODE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-5 border-t border-white/10 pt-4">
                  {['cpu', 'memory', 'storage'].map(metric => <div key={metric}><p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">{metric}</p><p className="font-mono text-sm mt-1">{node.telemetry?.[metric] ?? '--'}</p></div>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div className="text-white">
      <style>{`.forge-input{width:100%;min-height:44px;background:#050505;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:10px 12px;color:white;font-size:12px;outline:none}.forge-input:focus{border-color:#2684ff}.forge-primary{width:100%;min-height:44px;background:#fff;color:#050505;border-radius:6px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px}.forge-primary:disabled{opacity:.45;cursor:not-allowed}`}</style>
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 border-b border-white/10 pb-7">
        <div>
          <div className="flex items-center gap-2 text-[#4da3ff]"><ShieldCheck size={16}/><span className="text-[10px] font-black uppercase tracking-[0.22em]">Operated by GBA Forge</span></div>
          <h2 className="text-3xl md:text-4xl font-serif italic font-bold mt-2">Infrastructure Control Plane</h2>
          <p className="text-sm text-neutral-500 mt-2 max-w-2xl">Activos, capital y nodos reales. Mothership registra decisiones; no convierte negociaciones en gastos ni equipos planeados en servidores activos.</p>
        </div>
        <button type="button" onClick={loadInfrastructure} title="Actualizar Infrastructure" className="w-11 h-11 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/></button>
      </header>

      <div className="flex gap-1 border-b border-white/10 mb-9 overflow-x-auto" role="tablist" aria-label="Áreas de Infrastructure">
        {AREA_OPTIONS.map(area => {
          const Icon = area.icon;
          return <button key={area.id} type="button" role="tab" aria-selected={activeArea === area.id} onClick={() => setActiveArea(area.id)} className={`h-11 px-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${activeArea === area.id ? 'border-[#2684ff] text-white' : 'border-transparent text-neutral-600 hover:text-neutral-300'}`}><Icon size={14}/>{area.label}</button>;
        })}
      </div>

      {notice && <div className={`mb-7 border px-4 py-3 rounded-lg text-xs font-bold ${notice.type === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>{notice.message}</div>}

      {loading && accounts.length === 0 ? (
        <div className="min-h-64 flex items-center justify-center gap-3 text-neutral-500"><Activity size={18} className="animate-spin"/><span className="text-xs font-black uppercase tracking-widest">Loading control plane</span></div>
      ) : (
        <>
          {activeArea === 'overview' && renderOverview()}
          {activeArea === 'ledger' && renderLedger()}
          {activeArea === 'assets' && renderAssets()}
          {activeArea === 'nodes' && renderNodes()}
        </>
      )}
    </div>
  );
}

function LedgerRows({ entries, onDelete }) {
  return (
    <div className="border-y border-white/10 divide-y divide-white/10">
      {entries.map(entry => {
        const outgoing = entry.entry_type === 'expense';
        const currency = entry.gba_budget_accounts?.currency || 'MXN';
        return (
          <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 items-center py-4">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className={`text-[8px] font-black uppercase tracking-wider ${outgoing ? 'text-red-400' : 'text-green-400'}`}>{ENTRY_LABELS[entry.entry_type]}</span>{entry.reimbursable && <span className="text-[8px] font-black uppercase tracking-wider text-yellow-400">Reembolsable</span>}</div><p className="font-bold text-sm mt-1 truncate">{entry.concept}</p><p className="text-[10px] text-neutral-600 mt-1">{entry.gba_budget_accounts?.code} · {entry.entry_date}{entry.counterparty ? ` · ${entry.counterparty}` : ''}</p></div>
            <p className={`font-bold tabular-nums text-sm ${outgoing ? 'text-red-300' : 'text-green-300'}`}>{outgoing ? '-' : '+'}{formatMoney(entry.amount, currency)}</p>
            <button type="button" onClick={() => onDelete(entry)} title="Eliminar movimiento" className="w-9 h-9 rounded-full text-neutral-600 hover:bg-red-500/10 hover:text-red-400 flex items-center justify-center transition-colors"><Trash2 size={14}/></button>
          </div>
        );
      })}
    </div>
  );
}
