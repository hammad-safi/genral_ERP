import React, { useState, useEffect, useMemo } from 'react';
import { Shield, UserPlus, UserX, UserCheck, Trash2, Edit, Save, Plus, AlertCircle, Key, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ImageUpload from '@/components/ImageUpload';
import CustomSelect from '@/components/CustomSelect';
import { format } from 'date-fns';
import GlobalTable from '@/components/GlobalTable';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalButton from '@/components/GlobalButton';
import GlobalFilter from '@/components/GlobalFilter';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';
import { useApiPagination } from '@/hooks/useApiPagination';

const MODULES = ['Dashboard', 'Inventory', 'POS', 'Sales', 'Purchases', 'Suppliers', 'Customers', 'Expenses', 'Reports', 'Settings', 'Users'];
const ACTIONS = ['View', 'Add', 'Edit', 'Delete', 'Export'];

export default function UsersAndRoles() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage staff accounts, assign roles, configure permissions, and monitor system activity."
        icon={Shield}
      />

      <div className="flex gap-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'users' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserPlus size={16} /> Staff Accounts
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'roles' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key size={16} /> Roles & Permissions
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'audit' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity size={16} /> Activity Log
        </button>
      </div>

      <div className="pt-2">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'audit' && <AuditTab />}
      </div>
    </div>
  );
}

// =========================================================================
// USERS TAB
// =========================================================================
const userOptionalCols = ['Contact Info', 'Role', 'Status', 'Last Login'];

function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [roleFilter, setRoleFilter] = useState('All');
  
  const [form, setForm] = useState({
    username: '', password: '', role: '', isActive: true,
    fullName: '', email: '', address: '', profilePicture: ''
  });

  const [searchTerm, setSearchTerm] = useState('');

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('users_visible_columns');
      return saved ? JSON.parse(saved) : userOptionalCols;
    } catch {
      return userOptionalCols;
    }
  });

  const toggleColumn = (col) => {
    setVisibleCols(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('users_visible_columns', JSON.stringify(next));
      return next;
    });
  };

  const loadData = async () => {
    try {
      const uRes = await fetch('/api/users');
      const uData = await uRes.json();
      setUsers(uData);

      const rRes = await fetch('/api/roles');
      const rData = await rRes.json();
      setRoles(rData);
    } catch (e) {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.role) return;
    
    if (!editingUser && !form.password) {
      alert("Password is required for new users");
      return;
    }

    try {
      let res;
      if (editingUser) {
        res = await fetch('/api/users/' + editingUser.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
      } else {
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
      }
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert("Failed to save user: " + (errData.error || "Internal Server Error"));
        return;
      }
      setIsFormOpen(false);
      loadData();
    } catch (e) {}
  };

  const toggleStatus = async (user) => {
    if (user.username === 'admin' || user.id === currentUser?.id) return;
    await fetch('/api/users/' + user.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive })
    });
    loadData();
  };

  const handleDelete = async (user) => {
    if (user.username === 'admin' || user.id === currentUser?.id) return;
    if (confirm('Delete this user?')) {
      await fetch('/api/users/' + user.id, { method: 'DELETE' });
      loadData();
    }
  };

  const handleEdit = (u) => {
    setEditingUser(u);
    setForm({ username: u.username, password: '', role: u.role, isActive: u.isActive, fullName: u.fullName || '', email: u.email || '', address: u.address || '', profilePicture: u.profilePicture || '' });
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingUser(null);
    setForm({ username: '', password: '', role: '', isActive: true, fullName: '', email: '', address: '', profilePicture: '' });
    setIsFormOpen(true);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchRole = roleFilter === 'All' || u.role === roleFilter;
      if (!matchRole) return false;
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        u.username.toLowerCase().includes(s) || 
        (u.fullName && u.fullName.toLowerCase().includes(s)) || 
        (u.email && u.email.toLowerCase().includes(s)) || 
        (u.role && u.role.toLowerCase().includes(s))
      );
    });
  }, [users, searchTerm, roleFilter]);

  const dynamicColumns = [
    { header: "Staff Member" },
    ...(visibleCols.includes('Contact Info') ? [{ header: "Contact Info" }] : []),
    ...(visibleCols.includes('Role') ? [{ header: "Assigned Role" }] : []),
    ...(visibleCols.includes('Status') ? [{ header: "Account Status" }] : []),
    ...(visibleCols.includes('Last Login') ? [{ header: "Last Login" }] : []),
    { header: "Actions", className: "text-right" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-4 flex-1">
              <div className="max-w-md w-full">
                <GlobalSearch
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search staff by name, username, email, or role..."
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <GlobalFilter
                  options={[
                    { label: 'All Roles', value: 'All' },
                    ...roles.map(r => ({ label: r.name, value: r.name }))
                  ]}
                  value={roleFilter}
                  onChange={setRoleFilter}
                  variant="select"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0 justify-end">
              <ColumnVisibilityDropdown
                columns={userOptionalCols}
                visibleCols={visibleCols}
                toggleColumn={toggleColumn}
              />
              <GlobalButton
                icon={Plus}
                onClick={handleAdd}
              >
                Add New User
              </GlobalButton>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="font-bold text-slate-900">Displaying {filteredUsers.length} staff accounts</span>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <GlobalTable
            columns={dynamicColumns}
            data={filteredUsers}
            rowKey="id"
            renderRow={(u, index, measureRef) => {
              const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
              return (
                <tr 
                  key={u.id || index}
                  ref={measureRef}
                  data-index={index}
                  className={`border-b border-slate-200 hover:bg-slate-100 transition-colors ${rowBg}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.profilePicture ? (
                        <img src={u.profilePicture} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-200">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm">{u.fullName || u.username}</span>
                        <span className="text-xs font-medium text-slate-500">@{u.username}</span>
                      </div>
                    </div>
                  </td>
                  {visibleCols.includes('Contact Info') && (
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700 text-sm">{u.email || '—'}</span>
                        <span className="text-xs text-slate-400">{u.address || '—'}</span>
                      </div>
                    </td>
                  )}
                  {visibleCols.includes('Role') && (
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                        {u.role}
                      </span>
                    </td>
                  )}
                  {visibleCols.includes('Status') && (
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  )}
                  {visibleCols.includes('Last Login') && (
                    <td className="px-4 py-3 text-slate-500 text-sm font-medium">
                      {u.lastLogin ? format(new Date(u.lastLogin), 'MMM d, yyyy HH:mm') : 'Never Logged In'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2 pr-2">
                      <button onClick={() => toggleStatus(u)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title={u.isActive ? "Disable User" : "Enable User"}>
                        {u.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button onClick={() => handleEdit(u)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit User">
                        <Edit size={16} />
                      </button>
                      {u.username !== 'admin' && u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete User">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }}
            emptyState={
              <div className="p-8 text-center text-slate-500">
                No staff accounts found matching "{searchTerm}"
              </div>
            }
          />
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-extrabold text-slate-900 mb-6 shrink-0">{editingUser ? 'Edit Staff Account' : 'Create Staff Account'}</h3>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6">
              
              <div className="flex gap-6 flex-col md:flex-row">
                <div className="w-full md:w-1/3 flex flex-col items-center gap-2">
                  <label className="block text-sm font-bold text-slate-700 w-full">Profile Picture</label>
                  <ImageUpload 
                    value={form.profilePicture} 
                    onChange={v => setForm({...form, profilePicture: v})} 
                  />
                  <p className="text-[11px] text-slate-400 text-center mt-2">Allowed *.jpeg, *.jpg, *.png, *.gif<br/>Max size of 3 MB</p>
                </div>
                
                <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={e => setForm({...form, fullName: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-500 transition-colors font-medium text-sm"
                      placeholder="e.g. John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({...form, email: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-500 transition-colors font-medium text-sm"
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Username *</label>
                    <input
                      type="text"
                      required
                      disabled={editingUser?.username === 'admin'}
                      value={form.username}
                      onChange={e => setForm({...form, username: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-500 transition-colors font-medium text-sm disabled:bg-slate-50"
                      placeholder="e.g. jsmith"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      Password {editingUser ? '(leave blank to keep unchanged)' : '*'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={form.password}
                      onChange={e => setForm({...form, password: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-500 transition-colors font-medium text-sm"
                      placeholder={editingUser ? "••••••••" : "Choose a secure password"}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Assign Role *</label>
                    <CustomSelect
                      value={form.role}
                      onChange={v => setForm({...form, role: v})}
                      options={roles.map(r => ({ label: r.name, value: r.name }))}
                      placeholder="-- Select a Role --"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Address</label>
                    <textarea
                      value={form.address}
                      onChange={e => setForm({...form, address: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-500 transition-colors font-medium text-sm resize-none h-20"
                      placeholder="e.g. 123 Main St, City, Country"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-slate-100 shrink-0 sticky bottom-0 bg-white pb-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm">
                  {editingUser ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// ROLES TAB
// =========================================================================
function RolesTab() {
  const [roles, setRoles] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState({ name: '', permissions: {} });

  const loadRoles = async () => {
    const res = await fetch('/api/roles');
    setRoles(await res.json());
  };

  useEffect(() => { loadRoles(); }, []);

  const handleEdit = (r) => {
    setEditingRole(r);
    setForm({ name: r.name, permissions: JSON.parse(JSON.stringify(r.permissions)) });
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingRole(null);
    const defaultPerms = {};
    MODULES.forEach(m => defaultPerms[m] = { View: false, Add: false, Edit: false, Delete: false, Export: false });
    setForm({ name: '', permissions: defaultPerms });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    
    if (editingRole) {
      await fetch('/api/roles/' + editingRole.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
    } else {
      await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
    }
    setIsFormOpen(false);
    loadRoles();
  };

  const handleDelete = async (r) => {
    if (r.isSystem) return;
    if (confirm('Delete this role?')) {
      await fetch('/api/roles/' + r.id, { method: 'DELETE' });
      loadRoles();
    }
  };

  const togglePerm = (module, action) => {
    if (editingRole?.isSystem && editingRole.name === 'Admin') return;
    setForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: {
          ...(prev.permissions[module] || {}),
          [action]: !(prev.permissions[module]?.[action])
        }
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Key className="text-blue-500" size={20} /> Role Templates
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Configure role-based access rights across store modules.</p>
        </div>
        <GlobalButton
          icon={Plus}
          onClick={handleAdd}
        >
          Create Role
        </GlobalButton>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(r => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            {r.isSystem && (
              <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-bl-lg border-b border-l border-slate-200">
                System Default
              </div>
            )}
            <div className="flex flex-col h-full">
              <h4 className="text-xl font-extrabold text-slate-900 mb-2 mt-2">{r.name}</h4>
              <p className="text-xs text-slate-500 mb-6 flex-1">
                {r.name === 'Admin' ? 'Complete uncontrolled access to all settings and records.' :
                 r.name === 'Manager' ? 'High-level operational access across inventory and daily records.' :
                 r.name === 'Cashier' ? 'Point of sale and front-desk customer transaction privileges.' :
                 'Custom user role with tailored administrative access.'}
              </p>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                <span className="text-xs font-bold text-slate-400">
                  {Object.values(r.permissions || {}).reduce((acc, p) => acc + Object.values(p).filter(Boolean).length, 0)} Active Permissions
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(r)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Role Matrix"
                  >
                    <Edit size={16} />
                  </button>
                  {!r.isSystem && (
                    <button 
                      onClick={() => handleDelete(r)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Role"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-extrabold text-slate-900 mb-4 shrink-0">
              {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Custom Role'}
            </h3>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Role Name *</label>
                <input
                  type="text"
                  required
                  disabled={editingRole?.isSystem}
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-500 transition-colors font-medium text-sm disabled:bg-slate-50"
                  placeholder="e.g. Inventory Clerk"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">Permissions Matrix</label>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Module</th>
                        {ACTIONS.map(action => (
                          <th key={action} className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{action}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {MODULES.map(module => (
                        <tr key={module} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800">{module}</td>
                          {ACTIONS.map(action => {
                            const isChecked = !!(form.permissions?.[module]?.[action]);
                            const isDisabled = editingRole?.isSystem && editingRole.name === 'Admin';
                            return (
                              <td key={action} className="py-3 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={() => togglePerm(module, action)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0 sticky bottom-0 bg-white">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingRole?.isSystem && editingRole.name === 'Admin'}
                  className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all"
                >
                  Save Permissions Matrix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// AUDIT TAB
// =========================================================================
const auditOptionalCols = ['Timestamp', 'Staff Member', 'Module', 'Action Type', 'Details'];

function AuditTab() {
  const [limit, setLimit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('audit_visible_columns');
      return saved ? JSON.parse(saved) : auditOptionalCols;
    } catch {
      return auditOptionalCols;
    }
  });

  const toggleColumn = (col) => {
    setVisibleCols(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('audit_visible_columns', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  const { data: logs, totalItems, setPageIndex, refresh, loading: tableLoading } = useApiPagination({
    endpoint: '/api/audit',
    pageSize: limit,
    search: debouncedSearch,
    mode: 'infinite'
  });

  const dynamicColumns = [
    ...(visibleCols.includes('Timestamp') ? [{ header: "Timestamp" }] : []),
    ...(visibleCols.includes('Staff Member') ? [{ header: "Staff Member" }] : []),
    ...(visibleCols.includes('Module') ? [{ header: "Module" }] : []),
    ...(visibleCols.includes('Action Type') ? [{ header: "Action Type" }] : []),
    ...(visibleCols.includes('Details') ? [{ header: "Action Details" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-4 flex-1">
              <div className="max-w-md w-full">
                <GlobalSearch
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search audit logs by staff, action, or module..."
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0 justify-end">
              <ColumnVisibilityDropdown
                columns={auditOptionalCols}
                visibleCols={visibleCols}
                toggleColumn={toggleColumn}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="font-bold text-slate-900">Displaying {logs.length} of {totalItems} audit log entries</span>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <GlobalTable
            onLoadMore={() => setPageIndex(p => p + 1)}
            hasMore={logs.length < totalItems}
            columns={dynamicColumns}
            data={logs}
            rowKey="id"
            renderRow={(log, index, measureRef) => {
              const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
              return (
                <tr 
                  key={log.id || index}
                  ref={measureRef}
                  data-index={index}
                  className={`border-b border-slate-200 hover:bg-slate-100 transition-colors ${rowBg}`}
                >
                  {visibleCols.includes('Timestamp') && (
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md text-xs border border-slate-200">
                        {log.timestamp ? format(new Date(log.timestamp), 'MMM d, yyyy - HH:mm') : '—'}
                      </span>
                    </td>
                  )}
                  {visibleCols.includes('Staff Member') && (
                    <td className="px-4 py-3 font-extrabold text-slate-900 text-sm">
                      {log.userName || 'System'}
                    </td>
                  )}
                  {visibleCols.includes('Module') && (
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">{log.module}</span>
                    </td>
                  )}
                  {visibleCols.includes('Action Type') && (
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase border ${
                        log.action === 'LOGIN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        log.action === 'DELETE' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        log.action === 'CREATE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        log.action === 'UPDATE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                  )}
                  {visibleCols.includes('Details') && (
                    <td className="px-4 py-3 text-slate-600 font-medium text-sm">
                      {log.details || '—'}
                    </td>
                  )}
                </tr>
              );
            }}
            emptyState={
              <div className="p-8 text-center text-slate-500">
                {tableLoading ? 'Loading audit records...' : `No audit logs found matching "${searchTerm}"`}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
