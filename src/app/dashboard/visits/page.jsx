"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, Plus, MoreVertical, Edit, Trash2, Eye, Filter, Calendar as CalendarIcon, 
  MapPin, User, Briefcase, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useSession } from "next-auth/react";
import { PERMISSIONS, hasPermission } from "@/lib/rbac/permissions";

export default function VisitsPage() {
  const { data: session } = useSession();
  const userPermissions = session?.user?.permissions || [];
  const isAdmin = session?.user?.role === 'Admin' || session?.user?.role === 'admin';
  const canCreate = isAdmin || hasPermission(userPermissions, PERMISSIONS.VISIT.CREATE);
  const canEdit = isAdmin || hasPermission(userPermissions, PERMISSIONS.VISIT.EDIT);
  const canDelete = isAdmin || hasPermission(userPermissions, PERMISSIONS.VISIT.DELETE);

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const limit = 10;

  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visits?page=${page}&limit=${limit}`);
      const data = await res.json();
      if (data.visits) {
        setVisits(data.visits);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch visits", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, [page]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this visit?')) return;
    try {
      const res = await fetch(`/api/visits/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchVisits();
      }
    } catch (error) {
      console.error("Failed to delete visit", error);
    }
  };

  const filteredVisits = visits.filter(v => {
    if (search && !v.customerName?.toLowerCase().includes(search.toLowerCase()) && !v.salesPersonName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && v.visitType !== filterType) return false;
    if (filterStatus && v.status !== filterStatus) return false;
    return true;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Pending Approval': return 'bg-yellow-100 text-yellow-700';
      case 'Draft': return 'bg-gray-100 text-gray-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleAction = async (id, action) => {
    let confirmMsg = '';
    if (action === 'submit') confirmMsg = 'Submit Visit for Approval?\n\nOnce submitted, this visit will be sent for approval and can no longer be edited until reviewed.';
    if (action === 'approve') confirmMsg = 'Are you sure you want to approve this visit?';
    if (action === 'reject') confirmMsg = 'Are you sure you want to reject this visit?';
    if (action === 'complete') confirmMsg = 'Mark this visit as completed?';

    if (confirmMsg && !window.confirm(confirmMsg)) return;

    let reason = '';
    if (action === 'reject') {
        reason = window.prompt("Please provide a reason for rejection:");
        if (reason === null) return;
    }

    try {
      const res = await fetch(`/api/visits/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason, userId: session?.user?.id })
      });
      if (res.ok) {
        fetchVisits();
      } else {
        const errorData = await res.json();
        alert(`Failed: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error(error);
      alert(`Error performing action`);
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'Meeting': return 'bg-blue-100 text-blue-700';
      case 'Site Visit': return 'bg-purple-100 text-purple-700';
      case 'Follow-up': return 'bg-indigo-100 text-indigo-700';
      case 'Support': return 'bg-orange-100 text-orange-700';
      case 'Collection': return 'bg-teal-100 text-teal-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visits Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage all customer interactions</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={fetchVisits} className="p-2 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
            <RefreshCw size={18} />
          </button>
          {canCreate && (
            <Link href="/dashboard/visits/new" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              <Plus size={18} />
              <span>New Visit</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search customers or salespersons..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter size={16} />
            <span className="hidden sm:inline">Filters:</span>
          </div>
          
          <select 
            className="border border-gray-200 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="Meeting">Meeting</option>
            <option value="Site Visit">Site Visit</option>
            <option value="Follow-up">Follow-up</option>
            <option value="Support">Support</option>
            <option value="Collection">Collection</option>
          </select>

          <select 
            className="border border-gray-200 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Visit Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Salesperson</th>
                <th className="px-6 py-4">Report Snippet</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-32 animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-24 animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-100 rounded-full w-20 animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-100 rounded-full w-20 animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-28 animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-12 animate-pulse ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                        <Briefcase className="text-gray-400" size={24} />
                      </div>
                      <p className="text-base font-medium text-gray-900">No visits found</p>
                      <p className="text-sm mt-1 text-gray-500">Get started by creating a new visit.</p>
                      <Link href="/dashboard/visits/new" className="mt-4 text-sm text-blue-600 hover:underline font-medium">
                        Create Visit
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVisits.map((visit) => (
                  <React.Fragment key={visit._id}>
                    <tr 
                      className={`hover:bg-gray-50/50 transition-colors group cursor-pointer ${expandedId === visit._id ? 'bg-blue-50/30' : ''}`}
                      onClick={() => setExpandedId(prev => prev === visit._id ? null : visit._id)}
                    >
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/customers/${visit.customerId}`} className="font-medium text-gray-900 hover:text-blue-600" onClick={(e) => e.stopPropagation()}>
                          {visit.customerName}
                        </Link>
                        {visit.location?.address && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <MapPin size={12} />
                            <span className="truncate max-w-[200px]">{visit.location.address}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900 font-medium flex items-center gap-2">
                            <span>{new Date(visit.visitDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            {visit.visitTime && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{visit.visitTime}</span>}
                          </span>
                          {visit.nextFollowUpDate && (
                            <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <CalendarIcon size={12} /> Follow-up: {new Date(visit.nextFollowUpDate).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(visit.visitType)}`}>
                          {visit.visitType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(visit.status)}`}>
                          {visit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            {visit.salesPersonName ? visit.salesPersonName.charAt(0) : 'U'}
                          </div>
                          <span className="text-sm text-gray-700">{visit.salesPersonName || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-xs truncate">
                          {visit.reportDetails || <span className="text-gray-400 italic">No report</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit && (visit.status === 'Draft' || visit.status === 'Rejected') && (
                            <Link href={`/dashboard/visits/${visit._id}/edit`} className="p-1.5 text-gray-400 hover:text-green-600 rounded-md hover:bg-green-50" onClick={(e) => e.stopPropagation()}>
                              <Edit size={16} />
                            </Link>
                          )}
                          {canDelete && visit.status === 'Draft' && (
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(visit._id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === visit._id && (
                      <tr>
                        <td colSpan="7" className="px-0 py-0 border-b-2 border-blue-100">
                          <div className="bg-blue-50/40 px-8 py-6 shadow-inner text-sm text-gray-800">
                            
                            <div className="flex flex-wrap items-center justify-between mb-6 pb-4 border-b border-blue-100 gap-4">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-blue-900">Visit Details</h3>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(visit.status)}`}>
                                  {visit.status === 'Pending Approval' && <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>}
                                  {visit.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {(visit.status === 'Draft' || visit.status === 'Rejected') && canEdit && (
                                  <button onClick={() => handleAction(visit._id, 'submit')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                                    Submit for Approval
                                  </button>
                                )}
                                {visit.status === 'Pending Approval' && isAdmin && (
                                  <>
                                    <button onClick={() => handleAction(visit._id, 'approve')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm">
                                      Approve
                                    </button>
                                    <button onClick={() => handleAction(visit._id, 'reject')} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
                                      Reject
                                    </button>
                                  </>
                                )}
                                {visit.status === 'Approved' && canEdit && (
                                  <button onClick={() => handleAction(visit._id, 'complete')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                                    Mark as Completed
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <h4 className="font-semibold text-blue-900 mb-3 uppercase tracking-wider text-xs">Full Visit Details</h4>
                                <div className="space-y-3">
                                  <div><span className="text-gray-500 w-32 inline-block">Visit ID:</span> <span className="font-mono text-xs">{visit._id}</span></div>
                                  <div><span className="text-gray-500 w-32 inline-block">Customer:</span> <span>{visit.customerName} ({visit.customerId})</span></div>
                                  <div>
                                    <span className="text-gray-500 w-32 inline-block">Date & Time:</span> 
                                    <span>
                                      {new Date(visit.visitDate).toLocaleDateString('en-GB')}
                                      {visit.visitTime ? ` at ${visit.visitTime}` : ''}
                                    </span>
                                  </div>
                                  <div><span className="text-gray-500 w-32 inline-block">Salesperson:</span> <span>{visit.salesPersonName || 'Unassigned'}</span></div>
                                  <div>
                                    <span className="text-gray-500 w-32 inline-block">Location:</span> 
                                    <span>{visit.location?.address || 'Not specified'} {visit.location?.latitude ? `[${visit.location.latitude}, ${visit.location.longitude}]` : ''}</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold text-blue-900 mb-3 uppercase tracking-wider text-xs">Timestamps & Attachments</h4>
                                <div className="space-y-3">
                                  <div><span className="text-gray-500 w-32 inline-block">Created At:</span> <span>{new Date(visit.createdAt).toLocaleString('en-GB')}</span></div>
                                  <div><span className="text-gray-500 w-32 inline-block">Last Updated:</span> <span>{new Date(visit.updatedAt).toLocaleString('en-GB')}</span></div>
                                  <div>
                                    <span className="text-gray-500 w-32 inline-block">Attachments:</span> 
                                    <span>{visit.attachments?.length ? `${visit.attachments.length} files` : 'None'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {visit.reportDetails && (
                              <div className="mt-6 pt-4 border-t border-blue-100">
                                <h4 className="font-semibold text-blue-900 mb-2 uppercase tracking-wider text-xs">Report Content</h4>
                                <div className="bg-white p-4 rounded border border-blue-100 whitespace-pre-wrap leading-relaxed text-gray-700 shadow-sm">
                                  {visit.reportDetails}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && total > limit && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span> results
            </span>
            <div className="flex items-center gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
