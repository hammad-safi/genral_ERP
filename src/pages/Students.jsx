import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, BookOpen, Edit, Trash2 } from 'lucide-react';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import { initDB, getDB } from '@/lib/db';
import { formatCurrency, forceRepaintAfterRender, removeLeadingZeros } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness } from '@/contexts/BusinessContext';

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All Classes');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    await initDB();
    const currentDB = getDB();
    const studentsData = await currentDB.students.toArray();

    const studentsWithBalance = await Promise.all(
      studentsData.map(async (student) => {
        const ledger = await currentDB.studentLedger.where('studentId').equals(student.id).toArray();
        const totalCharged = ledger
          .filter(e => e.type === 'charge' || e.type === 'purchase')
          .reduce((sum, e) => sum + e.amount, 0);
        const totalPaid = ledger
          .filter(e => e.type === 'payment')
          .reduce((sum, e) => sum + e.amount, 0);
        return {
          ...student,
          balance: totalCharged - totalPaid,
          totalPaid
        };
      })
    );

    setStudents(studentsWithBalance);
  };

  const filteredStudents = useMemo(() => {
    let filtered = students;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(query) ||
        student.fatherName.toLowerCase().includes(query) ||
        student.rollNumber.toLowerCase().includes(query)
      );
    }

    if (classFilter !== 'All Classes') {
      filtered = filtered.filter(student => student.class === classFilter);
    }

    return filtered;
  }, [students, searchQuery, classFilter]);

  const uniqueClasses = useMemo(() => {
    const classes = [...new Set(students.map(s => s.class).filter(Boolean))];
    return classes.sort();
  }, [students]);

  const totalStudents = students.length;
  const totalOwed = students.reduce((sum, s) => sum + Math.max(0, s.balance), 0);
  const totalPaid = students.reduce((sum, s) => sum + s.totalPaid, 0);

  const getBalanceColor = (balance) => {
    if (balance === 0) return 'text-green-600';
    if (balance <= 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleEditStudent = (student) => {
    setEditStudent(student);
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent?.id) return;
    const currentDB = getDB();
    await currentDB.students.delete(selectedStudent.id);
    await currentDB.studentLedger.where('studentId').equals(selectedStudent.id).delete();
    setStudents((current) => current.filter((s) => s.id !== selectedStudent.id));
    setConfirmDelete(false);
    setSelectedStudent(null);
    forceRepaintAfterRender();
  };

  // Toggle single student selection
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(filteredStudents?.map(s => s.id) ?? []);
      setSelectAll(true);
    }
  };

  // Delete selected students - show React confirm dialog instead of window.confirm
  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    setConfirmBulkDelete(true);
  };

  const performBulkDelete = async () => {
    setConfirmBulkDelete(false);
    setIsDeleting(true);
    try {
      const currentDB = getDB();
      
      // Use bulk delete for better performance
      await currentDB.students.bulkDelete(selectedIds);
      
      // Delete ledger entries in parallel batches
      const ledgerDeletePromises = selectedIds.map(id => 
        currentDB.studentLedger.where('studentId').equals(id).delete()
      );
      await Promise.all(ledgerDeletePromises);
      
      setStudents(prev => prev.filter(s => !selectedIds.includes(s.id)));
      setSelectedIds([]);
      setSelectAll(false);
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Update selectAll when filteredStudents or selectedIds change
  useEffect(() => {
    const allSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.includes(s.id));
    setSelectAll(allSelected);
  }, [filteredStudents, selectedIds]);

  const handleSaveStudent = async (formData, isEdit = false) => {
    await initDB();
    const currentDB = getDB();
    
    if (isEdit && formData.id) {
      await currentDB.students.update(formData.id, {
        name: formData.name,
        fatherName: formData.fatherName,
        rollNumber: formData.rollNumber,
        phone: formData.phone || '',
        fatherPhone: formData.fatherPhone || '',
        class: formData.class || '',
        address: formData.address || '',
      });
      setStudents((current) =>
        current.map((s) =>
          s.id === formData.id ? { ...s, ...formData } : s
        )
      );
    } else {
      const studentId = await currentDB.students.add({
        name: formData.name,
        fatherName: formData.fatherName,
        rollNumber: formData.rollNumber,
        phone: formData.phone || '',
        fatherPhone: formData.fatherPhone || '',
        class: formData.class || '',
        address: formData.address || '',
        createdAt: new Date().toISOString()
      });

      if (formData.openingBalance && formData.openingBalance > 0) {
        await currentDB.studentLedger.add({
          studentId,
          type: 'charge',
          amount: Number(formData.openingBalance),
          description: 'Opening balance',
          date: new Date().toISOString()
        });
      }
      
      await loadStudents();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Manage student accounts and fee tracking" />

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Total Students"
          value={totalStudents.toString()}
          description="Active student accounts"
        />
        <StatsCard
          title="Total Owed"
          value={formatCurrency(totalOwed, currency)}
          description="Outstanding balances"
        />
        <StatsCard
          title="Total Paid"
          value={formatCurrency(totalPaid, currency)}
          description="Payments received"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, roll number, father name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-4 py-2 bg-white text-slate-900 placeholder-slate-400"
        />
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-900"
        >
          <option>All Classes</option>
          {uniqueClasses.map(cls => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setEditStudent(null);
            setAddModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Student
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[58vh]">
        <table className="w-full min-w-max">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Father Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Father Ph</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStudents.map((student) => (
              <tr key={student.id} className={selectedIds.includes(student.id) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(student.id)}
                    onChange={() => toggleSelect(student.id)}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.rollNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{student.name}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{student.fatherName}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{student.class}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{student.fatherPhone}</td>
                <td className={`px-4 py-3 text-sm font-medium ${getBalanceColor(student.balance)}`}>
                  {formatCurrency(student.balance, currency)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/students/${student.id}`)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View Khata"
                    >
                      <BookOpen className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditStudent(student)}
                      className="text-gray-600 hover:text-gray-800"
                      title="Edit Student"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    {!selectedIds.includes(student.id) ? (
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setConfirmDelete(true);
                        }}
                        className="text-red-600 hover:text-red-800"
                        title="Delete Student"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filteredStudents.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No students found
          </div>
        )}
      </div>

      {(addModalOpen || editStudent) && (
        <StudentModal
          student={editStudent}
          onClose={() => {
            setAddModalOpen(false);
            setEditStudent(null);
          }}
          onSave={(formData) => {
            handleSaveStudent(formData, !!editStudent);
            setAddModalOpen(false);
            setEditStudent(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete student"
        description="This will remove the student and all their ledger entries. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDeleteStudent}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedIds.length} students?`}
        description="This will permanently remove the selected students and all their ledger entries. This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
      />

      <BulkDeleteBar
        selectedCount={selectedIds.length}
        onDelete={deleteSelected}
        onCancel={() => { setSelectedIds([]); setSelectAll(false); }}
        itemLabel="student"
        isDeleting={isDeleting}
      />
    </div>
  );
}

function StudentModal({ student, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: student?.id || null,
    name: student?.name || '',
    fatherName: student?.fatherName || '',
    rollNumber: student?.rollNumber || '',
    phone: student?.phone || '',
    fatherPhone: student?.fatherPhone || '',
    class: student?.class || '',
    address: student?.address || '',
    openingBalance: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{student ? 'Edit Student' : 'Add New Student'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Student Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                placeholder="e.g. Ali Khan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Roll Number *</label>
              <input
                type="text"
                required
                value={formData.rollNumber}
                onChange={(e) => setFormData({...formData, rollNumber: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                placeholder="e.g. 2024-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Father Name *</label>
              <input
                type="text"
                required
                value={formData.fatherName}
                onChange={(e) => setFormData({...formData, fatherName: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                placeholder="e.g. Ahmad Khan"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Class / Grade 
                <span className="text-gray-400 font-normal text-xs"> (optional)</span>
              </label>
              <input
                type="text"
                value={formData.class}
                onChange={(e) => setFormData({...formData, class: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                placeholder="e.g. Class 5 or Grade 10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Father Phone 
                <span className="text-gray-400 font-normal text-xs"> (optional)</span>
              </label>
              <input
                type="tel"
                value={formData.fatherPhone}
                onChange={(e) => setFormData({...formData, fatherPhone: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                placeholder="e.g. 0312-1234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Student Phone 
                <span className="text-gray-400 font-normal text-xs"> (optional)</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                placeholder="Optional"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address 
                <span className="text-gray-400 font-normal text-xs"> (optional)</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                placeholder="Home address"
              />
            </div>

            {!student && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Opening Balance (Rs)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  min="1"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({...formData, openingBalance: Number(removeLeadingZeros(e.target.value))})}
                  onFocus={e => e.target.select()}
                  className="mt-1 block w-full border rounded-md px-3 py-2"
                  placeholder=""
                />
                <p className="text-xs text-gray-400 mt-1">
                  If student already owes money, enter amount here
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {student ? 'Update Student' : 'Save Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChargeModal({ studentId, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentDB = getDB();
    await currentDB.studentLedger.add({
      studentId,
      type: 'charge',
      amount: Number(amount),
      description: description || 'Purchase',
      date: new Date().toISOString()
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Charge</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount ({currency}) *</label>
            <input
              type="text"
              inputMode="decimal"
              min="1"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(removeLeadingZeros(e.target.value))}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder="Purchase description"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Add Charge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ studentId, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentDB = getDB();
    await currentDB.studentLedger.add({
      studentId,
      type: 'payment',
      amount: Number(amount),
      description: note || 'Payment received',
      date: new Date().toISOString()
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Record Payment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount ({currency}) *</label>
            <input
              type="text"
              inputMode="decimal"
              min="1"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(removeLeadingZeros(e.target.value))}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder="Payment note"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
