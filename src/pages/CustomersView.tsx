import React, { useState } from 'react';
import { Customer, CustomerStatus, CustomerType, UserRole, CustomerNote } from '../types';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Building,
  FileText,
  Calendar,
  X,
  AlertCircle,
  Eye,
  MessageSquare,
  Send,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../services/api';

interface CustomersViewProps {
  customers: Customer[];
  userRole?: UserRole;
  onRefresh: () => void;
  isOpenModalImmediately?: boolean;
  onCloseModalImmediately?: () => void;
}

export default function CustomersView({
  customers,
  userRole,
  onRefresh,
  isOpenModalImmediately,
  onCloseModalImmediately,
}: CustomersViewProps) {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(isOpenModalImmediately || false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Customer Details & Notes modal state
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    business_name: '',
    gst: '',
    type: 'Wholesaler' as CustomerType,
    address: '',
    status: 'Active' as CustomerStatus,
    follow_up_date: '',
    notes: '',
  });

  const statuses = ['All', 'Active', 'Prospect', 'Lead', 'Inactive'];

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.business_name.toLowerCase().includes(search.toLowerCase()) ||
      c.mobile.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.gst.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = selectedStatus === 'All' || c.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      mobile: '',
      email: '',
      business_name: '',
      gst: '',
      type: 'Wholesaler',
      address: '',
      status: 'Active',
      follow_up_date: '',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      mobile: c.mobile,
      email: c.email || '',
      business_name: c.business_name || '',
      gst: c.gst || '',
      type: c.type,
      address: c.address || '',
      status: c.status,
      follow_up_date: c.follow_up_date || '',
      notes: c.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    if (onCloseModalImmediately) onCloseModalImmediately();
  };

  // Open Details & Notes modal
  const handleOpenDetailModal = async (c: Customer) => {
    setDetailCustomer(c);
    setLoadingNotes(true);
    setNoteError(null);
    setNewNoteText('');
    try {
      const notes = await api.getCustomerNotes(c.id);
      setCustomerNotes(notes);
    } catch {
      setCustomerNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleCloseDetailModal = () => {
    setDetailCustomer(null);
    setCustomerNotes([]);
    setNewNoteText('');
    setNoteError(null);
  };

  // Submit follow-up note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailCustomer || !newNoteText.trim()) return;

    setSubmittingNote(true);
    setNoteError(null);
    try {
      const saved = await api.addCustomerNote(detailCustomer.id, newNoteText.trim());
      setCustomerNotes((prev) => [saved, ...prev]);
      setNewNoteText('');
      onRefresh();
    } catch (err: any) {
      setNoteError(err.message || 'Failed to add follow-up note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Customer contact name is required');
      return;
    }
    if (!formData.mobile.trim()) {
      setFormError('Mobile phone number is required');
      return;
    }

    setLoading(true);
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, formData);
      } else {
        await api.createCustomer(formData);
      }
      handleCloseModal();
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (userRole !== 'Admin') {
      alert('Only Admin users are authorized to delete customer records.');
      return;
    }
    if (confirm(`Are you sure you want to delete customer "${name}"?`)) {
      try {
        await api.deleteCustomer(id);
        onRefresh();
      } catch (err: any) {
        alert(`Failed to delete: ${err.message}`);
      }
    }
  };

  const getStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Prospect':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Lead':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Inactive':
        return 'bg-slate-200 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            Customer Relationship Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain buyer profiles, corporate GST numbers, contact history, and follow-up schedules.
          </p>
        </div>

        {(userRole === 'Admin' || userRole === 'Sales') && (
          <button
            id="btn-add-customer"
            onClick={handleOpenAddModal}
            className="neu-accent-btn px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-semibold shadow-md active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="neu-flat p-4 rounded-2xl border border-white/80 shadow-md flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, company, mobile, GST..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full neu-input pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedStatus === status
                  ? 'neu-pressed bg-[#e0e7f1] text-indigo-700 font-bold'
                  : 'neu-button text-slate-600 hover:text-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="neu-flat rounded-2xl border border-white/80 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300/70 bg-slate-200/40 text-slate-600 font-semibold">
                <th className="py-3 pl-4 pr-3">Customer & Business</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">GST & Type</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Follow-up</th>
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-sm">No customers found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {search ? 'Try adjusting your search criteria' : 'Click "Add Customer" to create the first record.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-100/60 transition-colors">
                    <td className="py-3.5 pl-4 pr-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl neu-flat flex items-center justify-center text-indigo-600 shrink-0 font-bold text-xs mt-0.5">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p
                            onClick={() => handleOpenDetailModal(c)}
                            className="font-bold text-slate-800 hover:text-indigo-600 cursor-pointer"
                          >
                            {c.name}
                          </p>
                          {c.business_name ? (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Building className="w-3 h-3 text-slate-400" />
                              <span>{c.business_name}</span>
                            </p>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Individual buyer</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="space-y-1">
                        <p className="text-slate-700 flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.mobile}</span>
                        </p>
                        {c.email && (
                          <p className="text-slate-500 flex items-center gap-1 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[140px]">{c.email}</span>
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div>
                        {c.gst ? (
                          <span className="font-mono text-[11px] font-semibold text-slate-700 block">
                            {c.gst}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Unregistered</span>
                        )}
                        <span className="text-[10px] text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded border border-slate-300/60 inline-block mt-0.5">
                          {c.type}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      {c.follow_up_date ? (
                        <span className="text-slate-600 text-[11px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(c.follow_up_date).toLocaleDateString()}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    <td className="py-3.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details & Notes */}
                        <button
                          id={`btn-view-customer-${c.id}`}
                          onClick={() => handleOpenDetailModal(c)}
                          title="View Details & Notes"
                          className="p-1.5 rounded-lg neu-button text-slate-600 hover:text-indigo-600"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {(userRole === 'Admin' || userRole === 'Sales') && (
                          <button
                            id={`btn-edit-customer-${c.id}`}
                            onClick={() => handleOpenEditModal(c)}
                            title="Edit Customer"
                            className="p-1.5 rounded-lg neu-button text-slate-600 hover:text-indigo-600"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {userRole === 'Admin' && (
                          <button
                            id={`btn-delete-customer-${c.id}`}
                            onClick={() => handleDelete(c.id, c.name)}
                            title="Delete Customer (Admin only)"
                            className="p-1.5 rounded-lg neu-button text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details & Follow-up Notes Modal */}
      {detailCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl neu-flat bg-[#e6ecf4] rounded-3xl p-6 md:p-8 border border-white/80 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-300/80">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl neu-flat flex items-center justify-center text-indigo-600 font-bold text-lg">
                  {detailCustomer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                    <span>{detailCustomer.name}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(detailCustomer.status)}`}>
                      {detailCustomer.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    {detailCustomer.business_name && <span>{detailCustomer.business_name} • </span>}
                    <span className="font-mono">{detailCustomer.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="p-2 rounded-xl neu-button text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Data Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="neu-flat p-2.5 rounded-xl border border-white/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mobile Phone</span>
                <span className="text-xs font-semibold text-slate-800 font-mono">{detailCustomer.mobile}</span>
              </div>
              <div className="neu-flat p-2.5 rounded-xl border border-white/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Email Address</span>
                <span className="text-xs font-semibold text-slate-800 truncate block">{detailCustomer.email || 'N/A'}</span>
              </div>
              <div className="neu-flat p-2.5 rounded-xl border border-white/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">GST Number</span>
                <span className="text-xs font-semibold text-slate-800 font-mono">{detailCustomer.gst || 'Unregistered'}</span>
              </div>
              <div className="neu-flat p-2.5 rounded-xl border border-white/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Category</span>
                <span className="text-xs font-semibold text-slate-800">{detailCustomer.type}</span>
              </div>
            </div>

            {detailCustomer.address && (
              <div className="neu-flat p-3 rounded-xl border border-white/60 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Billing & Delivery Address</span>
                <p className="text-slate-700">{detailCustomer.address}</p>
              </div>
            )}

            {/* Follow-up Notes Timeline & Input */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>CRM Follow-up Notes & Interactions</span>
                </h4>
                <span className="text-[10px] text-slate-400">
                  {customerNotes.length} note{customerNotes.length === 1 ? '' : 's'} recorded
                </span>
              </div>

              {/* Add Note Form (Admin / Sales) */}
              {(userRole === 'Admin' || userRole === 'Sales') && (
                <form onSubmit={handleAddNote} className="space-y-2">
                  {noteError && (
                    <p className="text-xs text-rose-600 bg-rose-100 p-2 rounded-lg">{noteError}</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add conversation notes, quotation follow-up, client request..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="flex-1 neu-input px-3 py-2 rounded-xl text-xs text-slate-800 placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={submittingNote || !newNoteText.trim()}
                      className="px-4 py-2 rounded-xl neu-accent-btn text-xs font-semibold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submittingNote ? 'Saving...' : 'Add Note'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Notes List */}
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {loadingNotes ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Loading customer notes...</p>
                ) : customerNotes.length === 0 ? (
                  <div className="p-4 rounded-xl neu-pressed text-center text-slate-400 text-xs">
                    No follow-up notes logged yet. Use the field above to record client conversations.
                  </div>
                ) : (
                  customerNotes.map((n) => (
                    <div key={n.id} className="neu-flat p-3 rounded-xl border border-white/60 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <UserIcon className="w-3 h-3" />
                          <span>{n.created_by}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(n.created_at).toLocaleString()}</span>
                        </span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">{n.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-300/80">
              {(userRole === 'Admin' || userRole === 'Sales') && (
                <button
                  onClick={() => {
                    handleCloseDetailModal();
                    handleOpenEditModal(detailCustomer);
                  }}
                  className="px-4 py-2 rounded-xl neu-button text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}
              <button
                onClick={handleCloseDetailModal}
                className="px-5 py-2 rounded-xl neu-button text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg neu-flat bg-[#e6ecf4] rounded-3xl p-6 md:p-8 border border-white/80 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-300/80 mb-5">
              <h3 className="font-bold text-base text-slate-800">
                {editingCustomer ? 'Edit Customer Details' : 'Add New Customer Account'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-2 rounded-xl neu-button text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Business / Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="e.g. Apex Industrial Supplies"
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="+91 98201 00000"
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GST Number
                  </label>
                  <input
                    type="text"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                    placeholder="27AABCA1234F1Z5"
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomerType })}
                    className="w-full neu-input px-3 py-2 rounded-xl text-xs text-slate-800 bg-[#edf2f8]"
                  >
                    <option value="Wholesaler">Wholesaler</option>
                    <option value="Retailer">Retailer</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Direct">Direct Client</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CRM Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as CustomerStatus })}
                    className="w-full neu-input px-3 py-2 rounded-xl text-xs text-slate-800 bg-[#edf2f8]"
                  >
                    <option value="Active">Active</option>
                    <option value="Prospect">Prospect</option>
                    <option value="Lead">Lead</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={formData.follow_up_date}
                    onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Billing / Delivery Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Warehouse / Industrial Park address"
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CRM Notes & Special Terms
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Payment credit terms, discount slabs, buyer preferences..."
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-300/80">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl neu-button text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all"
                >
                  {loading ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
