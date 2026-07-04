"use client";

import { useEffect, useState, useRef } from "react";
import { RefreshCcw, Plus, X, Trash2, Edit, FileText, Search, ChevronRight, AlertCircle, ListPlus, DownloadCloud } from "lucide-react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/app/components/DataTable";

const STATUS_STYLES = {
  draft: "bg-amber-100 text-amber-700 border border-amber-200",
  sent: "bg-blue-100 text-blue-700 border border-blue-200",
  accepted: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  declined: "bg-red-100 text-red-700 border border-red-200",
  expired: "bg-slate-100 text-slate-600 border border-slate-200",
};

function InputField({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        {...props}
        className="input-field w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-slate-50 focus:bg-white"
      />
    </div>
  );
}

function TextAreaField({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <textarea
        {...props}
        className="input-field w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-slate-50 focus:bg-white resize-none"
        rows={3}
      />
    </div>
  );
}

import { useSession } from "next-auth/react";
import { PERMISSIONS, hasPermission } from "@/lib/rbac/permissions";

function SearchableSelect({ options, value, onChange, placeholder, className }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const displayValue = isOpen ? query : (selectedOption ? selectedOption.label : "");

  const filtered = options.filter(o => (o.label || "").toLowerCase().includes((query || "").toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        className={className || "w-full border border-gray-300 rounded-md text-sm px-3 py-2 text-gray-700 bg-white focus:border-blue-500 outline-none"}
        placeholder={placeholder}
        value={displayValue}
        onChange={e => {
          setQuery(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onClick={() => {
          setQuery("");
          setIsOpen(true);
        }}
      />
      {isOpen && (
        <div className="absolute z-[100] w-full h-40 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto divide-y divide-gray-100">
          {filtered.length > 0 ? filtered.map((o, idx) => (
            <div
              key={`${o.value}-${idx}`}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-gray-700 text-left flex items-center justify-between"
              onClick={() => {
                onChange(o.value);
                setQuery("");
                setIsOpen(false);
              }}
            >
              <div>
                <div className="font-medium text-gray-800">{o.label}</div>
                {o.isItem && (
                  <div className="text-xs text-gray-500 mt-0.5">Rate: ₹{parseFloat(o.rate || 0).toFixed(2)}</div>
                )}
              </div>
              {o.isItem && (
                <div className="text-right">
                  <div className="text-xs text-gray-500 font-normal">Available for Sale</div>
                  <div className="text-xs font-semibold text-gray-800 mt-0.5">{o.availableForSale} {o.unit}</div>
                </div>
              )}
            </div>
          )) : (
            <div className="px-3 py-2 text-sm text-gray-500 text-left">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuotationsPage() {
  const { data: session } = useSession();
  const userPermissions = session?.user?.permissions || [];
  const canCreate = hasPermission(userPermissions, PERMISSIONS.QUOTATION.CREATE);
  const canEdit = hasPermission(userPermissions, PERMISSIONS.QUOTATION.EDIT);
  const canDelete = hasPermission(userPermissions, PERMISSIONS.QUOTATION.DELETE);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  function showToast(message, type = "success") {
    if (type === "error") {
      toast.error(message);
    } else {
      toast.success(message);
    }
  }

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;
  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchInput !== search) {
        if (searchInput) params.set("search", searchInput);
        else params.delete("search");
        params.set("page", "1");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, pathname, router, searchParams, search]);

  const updateUrlParams = (updates) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const { data: queryData, isLoading: loading, refetch: fetchQuotes } = useQuery({
    queryKey: ['quotations', page, limit, search, statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/zoho/quotes?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${statusFilter}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    placeholderData: keepPreviousData
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await fetch(`/api/zoho/customers?limit=1000`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await fetch(`/api/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: itemsData } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => {
      const res = await fetch(`/api/zoho/items`);
      if (!res.ok) throw new Error("Failed to fetch items");
      const json = await res.json();
      return json.data ? json.data : json;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: taxesData } = useQuery({
    queryKey: ['taxes-list'],
    queryFn: async () => {
      const res = await fetch(`/api/zoho/taxes`);
      if (!res.ok) throw new Error("Failed to fetch taxes");
      const json = await res.json();
      return json.data ? json.data : json;
    },
    staleTime: 5 * 60 * 1000,
  });

  const quotes = queryData?.data || [];
  const customers = customersData?.data || [];
  const users = usersData || [];
  const items = itemsData || [];
  const taxes = taxesData || [];
  const pagination = queryData?.pagination || { total: 0, page: 1, limit: 20 };

  const initialFormState = {
    customer_id: "",
    customer_name: "",
    estimate_number: "",
    reference_number: "",
    subject: "",
    date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    notes: "",
    terms: "",
    discount_percent: 0,
    adjustment: 0,
    line_items: [{ item_id: "", name: "", description: "", quantity: 1, rate: 0, tax_id: "" }],
    cf_quotation_creater: "",
    salesperson: "",
    project_name: "",
    offer_status: "Open",
    estimated_margin: "",
    epc_customer: "",
    project: "",
    end_user: "",
    market_segment: "",
  };

  const [form, setForm] = useState(initialFormState);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }





  // Helper to get tax percentage from tax_id
  function getTaxPercentage(taxId) {
    if (!taxId) return 0;
    const tax = taxes.find(t => (t.zoho_tax_id || t.tax_id || t._id) === taxId);
    return tax ? tax.tax_percentage : 0;
  }

  useEffect(() => {

    // Check for pending items from Actuators conversion
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("new") === "true") {
      const pendingItems = localStorage.getItem("pending_quotation_items");
      const prefillCustomerId = urlParams.get("customerId");

      if (pendingItems) {
        try {
          const items = JSON.parse(pendingItems);
          setForm(prev => ({
            ...prev,
            line_items: items,
            customer_id: prefillCustomerId || prev.customer_id
          }));
          if (canCreate) {
            setOpen(true);
          }
          localStorage.removeItem("pending_quotation_items");
          window.history.replaceState({}, '', '/dashboard/quotations');
        } catch (e) {
          console.error("Failed to load pending quotation items:", e);
        }
      } else if (prefillCustomerId) {
        setForm(prev => ({
          ...prev,
          customer_id: prefillCustomerId
        }));
        if (canCreate) {
          setOpen(true);
        }
        window.history.replaceState({}, '', '/dashboard/quotations');
      } else if (canCreate) {
        setOpen(true);
        window.history.replaceState({}, '', '/dashboard/quotations');
      }
    }
  }, [canCreate]);

  useEffect(() => {
    if (open && form.customer_id && !form.customer_name && customers.length > 0) {
      const cust = customers.find(c => (c.zoho_customer_id || c._id) === form.customer_id);
      if (cust) {
        setForm(prev => ({ ...prev, customer_name: cust.customer_name || cust.contact_name || "" }));
      }
    }
  }, [open, customers, form.customer_id, form.customer_name]);

  const formatDate = (date) => {
    if (!date) return "—";
    const dateStr = date.split("T")[0];
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount || 0);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleItemChange(index, field, value) {
    const updated = [...form.line_items];
    updated[index][field] = (field === "quantity" || field === "rate") ? Number(value) : value;
    setForm((prev) => ({ ...prev, line_items: updated }));
  }

  function addRow() {
    setForm((prev) => ({
      ...prev,
      line_items: [...prev.line_items, { item_id: "", name: "", description: "", quantity: 1, rate: 0, tax_id: prev.default_tax_id || "" }],
    }));
  }

  function removeRow(index) {
    setForm((prev) => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index),
    }));
  }

  // Computed totals
  const subTotal = form.line_items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
  const discountPercent = parseFloat(form.discount_percent) || 0;
  const discountAmount = (subTotal * discountPercent) / 100;
  const afterDiscount = subTotal - discountAmount;
  const taxTotal = form.line_items.reduce((acc, item) => {
    const lineAmount = item.quantity * item.rate;
    const taxPct = getTaxPercentage(item.tax_id);
    const lineTax = (lineAmount * taxPct) / 100;
    return acc + lineTax;
  }, 0);
  const adjustment = parseFloat(form.adjustment) || 0;
  const total = afterDiscount + taxTotal + adjustment;

  async function handleSaveQuotation(isSubmit = false) {
    if (!form.customer_id) { showToast("Please select a customer", "error"); return; }
    try {
      setSaving(true);
      const url = editingId ? `/api/zoho/quotes/${editingId}` : "/api/zoho/quotes/create";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isSubmit }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        showToast(data.error || "Failed to save", "error");
        return;
      }
      showToast(`Quotation ${editingId ? "updated" : "created"} successfully!`);
      setOpen(false);
      setEditingId(null);
      setForm(initialFormState);
      fetchQuotes();
    } catch (err) {
      console.error(err);
      showToast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuotation(id) {
    if (!window.confirm("Delete this quotation? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/zoho/quotes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.success === false) { showToast(data.error || "Failed to delete", "error"); return; }
      showToast("Quotation deleted successfully");
      fetchQuotes();
    } catch { showToast("Something went wrong", "error"); }
  }

  async function openEditModal(quote) {
    const id = quote.zoho_estimate_id || quote.estimate_id || quote._id;
    setEditingId(id);
    try {
      const res = await fetch(`/api/zoho/quotes/${id}`);
      const fullQuote = await res.json();

      if (!res.ok || fullQuote.error) {
        showToast(fullQuote.error || "Failed to fetch existing data from Zoho.", "error");
        setOpen(false);
        return;
      }

      if (fullQuote) {
        setForm({
          customer_id: fullQuote.customer_id || "",
          customer_name: fullQuote.customer_name || "",
          estimate_number: fullQuote.estimate_number || "",
          reference_number: fullQuote.reference_number || "",
          subject: fullQuote.subject || fullQuote.subject_content || "",
          date: fullQuote.date || new Date().toISOString().split("T")[0],
          expiry_date: fullQuote.expiry_date || "",
          notes: fullQuote.notes || "",
          terms: fullQuote.terms || "",
          discount_percent: fullQuote.discount || 0,
          adjustment: fullQuote.adjustment || 0,
          line_items: fullQuote.line_items?.map((item) => ({
            line_item_id: item.line_item_id,
            item_id: item.item_id,
            name: item.name || "",
            description: item.description || "",
            quantity: item.quantity || 1,
            rate: item.rate || 0,
            tax_id: item.tax_id || "",
          })) || [{ item_id: "", name: "", description: "", quantity: 1, rate: 0, tax_id: "" }],
          cf_quotation_creater: fullQuote.custom_fields?.find(cf => cf.api_name === "cf_quotation_creater")?.value || "",
          salesperson: fullQuote.salesperson_name || fullQuote.salesperson_id || "",
          project_name: fullQuote.project_id || fullQuote.custom_fields?.find(cf => cf.api_name === "cf_project_name" || cf.api_name === "project_name")?.value || "",
          offer_status: fullQuote.custom_fields?.find(cf => cf.api_name === "cf_offer_status" || cf.api_name === "offer_status")?.value || "Open",
          estimated_margin: fullQuote.custom_fields?.find(cf => cf.api_name === "cf_estimated_margin" || cf.api_name === "estimated_margin")?.value || "",
          epc_customer: fullQuote.custom_fields?.find(cf => cf.api_name === "cf_epc_customer" || cf.api_name === "epc_customer")?.value || "",
          project: fullQuote.custom_fields?.find(cf => cf.api_name === "cf_project" || cf.api_name === "project")?.value || "",
          end_user: fullQuote.custom_fields?.find(cf => cf.api_name === "cf_end_user" || cf.api_name === "end_user")?.value || "",
          market_segment: fullQuote.custom_fields?.find(cf => cf.api_name === "cf_market_segment" || cf.api_name === "market_segment")?.value || "",
        });
      }
    } catch (error) { console.error(error); }
    setOpen(true);
  }

  const filtered = quotes.filter(
    (q) => {
      const matchesSearch =
        q.estimate_number?.toLowerCase().includes(search.toLowerCase()) ||
        q.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        q.reference_number?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || q.status === statusFilter;

      return matchesSearch && matchesStatus;
    }
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="shimmer h-8 w-48 rounded-lg" />
          <div className="shimmer h-8 w-24 rounded-lg ml-auto" />
        </div>
        <div className="shimmer h-12 w-full rounded-xl mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="shimmer h-14 w-full rounded-xl mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {quotes.length} quotation{quotes.length !== 1 ? "s" : ""} from Zoho
          </p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={() => { setEditingId(null); setForm(initialFormState); setOpen(true); }}
              className="btn-press flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm shadow-indigo-200 transition-colors"
            >
              <Plus size={16} />
              New Quotation
            </button>
          )}
          <button
            onClick={() => fetchQuotes(true)}
            className="btn-press flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            title="Fetch all quotations from Zoho Books"
          >
            <DownloadCloud size={16} />
            Full Fetch
          </button>
          <button
            onClick={() => fetchQuotes(false)}
            className="btn-press flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-5">
        <select
          value={statusFilter}
          onChange={(e) => updateUrlParams({ status: e.target.value, page: 1 })}
          className="w-full sm:w-48 px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 outline-none focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="h-[600px]">
        <DataTable
          columns={[
            { label: "Date" },
            { label: "Quote No." },
            { label: "Ref No." },
            { label: "Customer" },
            { label: "Status" },
            { label: "Amount", className: "text-right" },
            { label: "Actions", className: "text-center" }
          ]}
          data={quotes}
          loading={loading}
          page={page}
          limit={limit}
          total={pagination.total}
          onPageChange={(p) => updateUrlParams({ page: p })}
          onLimitChange={(l) => updateUrlParams({ limit: l, page: 1 })}
          onSearch={(v) => setSearchInput(v)}
          searchValue={searchInput}
          emptyStateText="No quotations found"
          emptyStateSubtext="Try adjusting your search or create a new quotation"
          renderRow={(q) => {
            const id = q.zoho_estimate_id || q.estimate_id || q._id;
            return (
              <tr key={id} className="table-row-hover hover:bg-slate-50/70 group">
                <td className="px-5 py-4 text-slate-500 text-xs">{formatDate(q.date)}</td>
                <td className="px-5 py-4">
                  <Link
                    href={`/dashboard/quotations/${id}`}
                    className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 group-hover:underline"
                  >
                    <FileText size={13} className="flex-shrink-0" />
                    {q.estimate_number}
                    <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </td>
                <td className="px-5 py-4 text-slate-600">{q.reference_number || "—"}</td>
                <td className="px-5 py-4">
                  <div className="font-medium text-slate-800">{q.customer_name}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[q.status] || STATUS_STYLES.draft}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-semibold text-slate-800">
                  {formatCurrency(q.total)}
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => openEditModal(q)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Edit"
                      >
                        <Edit size={15} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteQuotation(id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          }}
        />
      </div>

      {open && (
        <div className="fixed top-0 bottom-0 right-0 left-0 md:left-64 bg-gray-50 flex justify-center items-start overflow-auto z-[50]">
          <div className="bg-white w-full min-h-full relative">
            <div className="flex justify-between items-center px-4 md:px-8 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
                  {editingId ? "Edit Estimate" : "New Estimate"}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="max-w-[1200px] mx-auto py-8 px-6 pb-40">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 gap-x-8 mb-12">
                <div className="md:col-span-3 flex items-center md:justify-end">
                  <label className="text-sm font-medium text-red-500">Customer Name*</label>
                </div>
                <div className="md:col-span-6 flex items-center">
                  <SearchableSelect
                    options={customers.map((c) => {
                      const name = c.customer_name || c.contact_name || "";
                      return {
                        value: c.zoho_customer_id || c._id,
                        label: name + (c.company_name && c.company_name !== name ? ` (${c.company_name})` : "")
                      };
                    })}
                    value={form.customer_id}
                    onChange={(val) => {
                      const selected = customers.find((c) => (c.zoho_customer_id || c._id) === val);
                      const gstNo = (selected?.gst_no || selected?.rawZohoData?.gst_no || "").trim();
                      const gst18Tax = taxes.find(t => t.tax_name === "GST18" || (t.tax_name?.includes("GST") && !t.tax_name?.includes("IGST") && t.tax_percentage === 18));
                      const igst18Tax = taxes.find(t => t.tax_name === "IGST18" || (t.tax_name?.includes("IGST") && t.tax_percentage === 18));
                      const defaultTaxId = gstNo.startsWith("33") 
                        ? (gst18Tax ? (gst18Tax.zoho_tax_id || gst18Tax.tax_id || gst18Tax._id) : "")
                        : (igst18Tax ? (igst18Tax.zoho_tax_id || igst18Tax.tax_id || igst18Tax._id) : "");

                      setForm((prev) => ({
                        ...prev,
                        customer_id: val,
                        customer_name: selected?.customer_name || selected?.contact_name || "",
                        default_tax_id: defaultTaxId,
                        line_items: prev.line_items.map(item => ({
                          ...item,
                          tax_id: defaultTaxId
                        }))
                      }));
                    }}
                    placeholder="Select or add a customer"
                    className="w-full border border-gray-300 rounded-l-md text-sm px-3 py-2 text-gray-700 bg-white focus:border-blue-500 outline-none"
                  />
                  <button className="bg-blue-500 hover:bg-blue-600 p-2 rounded-r-md text-white transition-colors">
                    <Search size={18} />
                  </button>
                </div>
                <div className="md:col-span-3"></div>

                <div className="md:col-span-3 flex items-center md:justify-end">
                  <label className="text-sm font-medium text-red-500">Estimate#*</label>
                </div>
                <div className="md:col-span-6 flex gap-3">
                  <input type="text" value="Default Transaction Series" readOnly className="w-1/2 border border-gray-300 rounded-md text-sm px-3 py-2 bg-gray-50 text-gray-500 outline-none" />
                  <input type="text" value={form.estimate_number || ""} onChange={(e) => setForm({ ...form, estimate_number: e.target.value })} className="w-1/2 border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" placeholder="e.g. EST-0001" />
                </div>
                <div className="md:col-span-3"></div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-gray-700">Reference#</label></div>
                <div className="md:col-span-6"><input type="text" name="reference_number" value={form.reference_number} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" /></div>
                <div className="md:col-span-3"></div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-gray-700">Creator</label></div>
                <div className="md:col-span-6">
                  <select name="cf_quotation_creater" value={form.cf_quotation_creater || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500 bg-white">
                    <option value="">Select Creator</option>
                    {users.map(u => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3"></div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-red-500">Estimate Date*</label></div>
                <div className="md:col-span-6 flex gap-6 items-center">
                  <input type="date" name="date" value={form.date} onChange={handleChange} className="flex-1 border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" />
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Expiry Date</label>
                  <input type="date" name="expiry_date" value={form.expiry_date} onChange={handleChange} className="flex-1 border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" />
                </div>
                <div className="md:col-span-3"></div>

                <div className="md:col-span-12 border-t border-gray-100 my-4"></div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-red-500">Salesperson*</label></div>
                <div className="md:col-span-6">
                  <select name="salesperson" value={form.salesperson || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500 bg-white">
                    <option value="">Select or Add Salesperson</option>
                    <option value="Mr.Krishnarajan">Mr.Krishnarajan</option>
                    {/* {users.map(u => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))} */}
                  </select>
                </div>
                <div className="md:col-span-3"></div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-gray-700">Project Name</label></div>
                <div className="md:col-span-6">
                  <select name="project_name" value={form.project_name || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500 bg-white">
                    <option value="">Select a project</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select a customer to associate a project.</p>
                </div>
                <div className="md:col-span-3"></div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-red-500">Offer Status *</label></div>
                <div className="md:col-span-3">
                  <select name="offer_status" value={form.offer_status || "Open"} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500 bg-white">
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex items-center md:justify-end"><label className="text-sm font-medium text-red-500">Estimated Margin *</label></div>
                <div className="md:col-span-4">
                  <input type="text" name="estimated_margin" value={form.estimated_margin || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" />
                </div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-gray-700">EPC/ Customer</label></div>
                <div className="md:col-span-3">
                  <input type="text" name="epc_customer" value={form.epc_customer || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" />
                </div>
                <div className="md:col-span-2 flex items-center md:justify-end"><label className="text-sm font-medium text-gray-700">Project</label></div>
                <div className="md:col-span-4">
                  <input type="text" name="project" value={form.project || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" />
                </div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-gray-700">End User</label></div>
                <div className="md:col-span-3">
                  <input type="text" name="end_user" value={form.end_user || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" />
                </div>
                <div className="md:col-span-2 flex items-center md:justify-end"><label className="text-sm font-medium text-red-500">Market Segment *</label></div>
                <div className="md:col-span-4">
                  <select name="market_segment" value={form.market_segment || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500 bg-white">
                    <option value="">Select Market Segment</option>
                    <option value="Oil & Gas">Oil & Gas</option>
                    <option value="Marine & Offshore">Marine & Offshore</option>
                    <option value="Water & Waste Water Treatment">Water & Waste Water Treatment</option>
                    <option value="General Industry">General Industry</option>
                    <option value="HVAC">HVAC</option>
                    <option value="Chemical & Petrochemical">Chemical & Petrochemical</option>
                    <option value="Pharmaceutical">Pharmaceutical</option>
                    <option value="Mining and Cement / Steel">Mining and Cement / Steel</option>
                    <option value="Energy">Energy</option>
                    <option value="Fire Fighting">Fire Fighting</option>
                    <option value="Food & Pharma">Food & Pharma</option>
                    <option value="Paper / Pulp / Sugar">Paper / Pulp / Sugar</option>
                    <option value="Building Solutions">Building Solutions</option>
                    <option value="Textile">Textile</option>
                  </select>
                </div>

                <div className="md:col-span-12 border-t border-gray-100 my-4"></div>

                <div className="md:col-span-3 flex items-center md:justify-end"><label className="text-sm font-medium text-gray-700">Subject</label></div>
                <div className="md:col-span-6"><input type="text" name="subject" value={form.subject} onChange={handleChange} placeholder="Let your customer know what this Estimate is for" className="w-full border border-gray-300 rounded-md text-sm px-3 py-2 outline-none focus:border-blue-500" /></div>
                <div className="md:col-span-3"></div>
              </div>

              <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 font-medium">Item Details</th>
                      <th className="px-5 py-3.5 font-medium w-32 text-right">Quantity</th>
                      <th className="px-5 py-3.5 font-medium w-40 text-right">Rate</th>
                      <th className="px-5 py-3.5 font-medium w-40 text-right">Tax</th>
                      <th className="px-5 py-3.5 font-medium w-32 text-right">Amount</th>
                      <th className="px-3 py-3.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.line_items.map((item, index) => {
                      const lineAmount = item.quantity * item.rate;
                      const lineTaxPct = getTaxPercentage(item.tax_id);
                      const lineTax = (lineAmount * lineTaxPct) / 100;
                      return (
                        <tr key={index} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-5 py-3 align-top">
                            <SearchableSelect
                              options={items.map(zohoItem => {
                                const rawData = zohoItem.rawZohoData || zohoItem;
                                const availableForSale = rawData.available_for_sale ?? zohoItem.available_stock ?? 0;
                                return {
                                  value: zohoItem.zoho_item_id || zohoItem.item_id || zohoItem._id,
                                  label: zohoItem.name,
                                  rate: zohoItem.rate || zohoItem.purchase_rate || 0,
                                  availableForSale: availableForSale,
                                  unit: zohoItem.unit || rawData.unit || "pcs",
                                  isItem: true
                                };
                              })}
                              value={item.item_id || ""}
                              onChange={(val) => {
                                const selectedItem = items.find(i => (i.zoho_item_id || i.item_id || i._id) === val);
                                const updated = [...form.line_items];
                                if (selectedItem) {
                                  updated[index] = {
                                    ...updated[index],
                                    item_id: val,
                                    name: selectedItem.name,
                                    description: selectedItem.description || selectedItem.purchase_description || "",
                                    rate: selectedItem.rate || selectedItem.purchase_rate || 0,
                                    tax_id: form.default_tax_id || updated[index].tax_id || ""
                                  };
                                } else {
                                  updated[index] = { ...updated[index], item_id: "", name: "", description: "", rate: 0 };
                                }
                                setForm(prev => ({ ...prev, line_items: updated }));
                              }}
                              placeholder="Select an item from Zoho"
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-sm outline-none text-gray-800 font-medium focus:border-blue-500 mb-2"
                            />
                            <input
                              type="text"
                              value={item.name}
                              onChange={e => handleItemChange(index, "name", e.target.value)}
                              placeholder="Or type item name manually..."
                              className="w-full text-sm text-gray-800 bg-transparent border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-500 mb-1"
                            />
                            <textarea
                              value={item.description || ""}
                              onChange={e => handleItemChange(index, "description", e.target.value)}
                              placeholder="Item description..."
                              className="w-full text-xs text-gray-500 bg-transparent border-0 focus:ring-0 outline-none resize-y-none mt-1"
                              rows={4}
                            />
                          </td>
                          <td className="px-5 py-3 align-top">
                            <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, "quantity", e.target.value)} className="w-full text-right bg-transparent border border-gray-200 rounded px-2 py-1 outline-none text-sm focus:border-blue-500" />
                          </td>
                          <td className="px-5 py-3 align-top">
                            <input type="number" min="0" step="any" value={item.rate} onChange={e => handleItemChange(index, "rate", e.target.value)} className="w-full text-right bg-transparent border border-gray-200 rounded px-2 py-1 outline-none text-sm focus:border-blue-500" />
                          </td>
                          <td className="px-5 py-3 align-top">
                            <select
                              value={item.tax_id || ""}
                              onChange={e => handleItemChange(index, "tax_id", e.target.value)}
                              className="w-full bg-transparent border border-gray-200 rounded px-2 py-1 outline-none text-sm text-gray-700 focus:border-blue-500"
                            >
                              <option value="">No Tax</option>
                              {taxes.map(t => {
                                const tid = t.zoho_tax_id || t.tax_id || t._id;
                                return (
                                  <option key={tid} value={tid}>{t.tax_name} ({t.tax_percentage}%)</option>
                                );
                              })}
                            </select>
                            {lineTax > 0 && <div className="text-xs text-green-600 mt-1 text-right">+{formatCurrency(lineTax)}</div>}
                          </td>
                          <td className="px-5 py-3 align-top text-right text-sm text-gray-800 font-semibold pt-4">
                            {formatCurrency(lineAmount)}
                          </td>
                          <td className="px-3 py-3 align-top text-center pt-4">
                            <button onClick={() => removeRow(index)} className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                              <X size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
                  <button onClick={addRow} className="text-blue-600 hover:text-blue-800 hover:underline text-sm flex items-center font-medium transition-colors">
                    <Plus size={15} className="mr-1" /> Add New Row
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between mt-8">
                <div className="w-full md:w-1/2 pr-8 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Customer Notes</label>
                    <textarea value={form.notes} onChange={handleChange} name="notes" rows={4} className="w-full border border-gray-300 rounded-md p-3 text-sm outline-none focus:border-blue-500 text-gray-700 shadow-sm" placeholder="We thank you for your enquiry and look forward for your confirmation of order.">We thank you for your enquiry and look forward for your confirmation of order.</textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
                    <textarea value={form.terms} onChange={handleChange} name="terms" rows={5} className="w-full border border-gray-300 rounded-md p-3 text-sm outline-none focus:border-blue-500 text-gray-700 shadow-sm" placeholder="All our transactions are governed by TruFlow Solutions Pvt Ltd's General Terms and Conditions for Sale..."></textarea>
                  </div>
                </div>

                <div className="w-full md:w-[400px] bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm h-fit">
                  <div className="flex justify-between items-center mb-5 text-sm">
                    <span className="font-semibold text-gray-700">Sub Total</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(subTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-5 text-sm">
                    <span className="text-gray-600">Discount</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white">
                        <input type="number" min="0" max="100" step="any" value={form.discount_percent} onChange={e => setForm(prev => ({ ...prev, discount_percent: e.target.value }))} className="w-14 text-right px-2 py-1.5 text-sm outline-none" placeholder="0" />
                        <span className="bg-gray-100 text-gray-500 px-2 py-1.5 border-l border-gray-300 font-medium">%</span>
                      </div>
                      <span className="text-red-500 font-medium w-20 text-right">-{formatCurrency(discountAmount)}</span>
                    </div>
                  </div>
                  {taxTotal > 0 && (
                    <div className="flex justify-between items-center mb-5 text-sm">
                      <span className="text-gray-600">Tax</span>
                      <span className="text-green-600 font-medium">+{formatCurrency(taxTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-5 text-sm">
                    <span className="text-gray-600">Adjustment</span>
                    <div className="flex items-center gap-3">
                      <input type="number" step="any" value={form.adjustment} onChange={e => setForm(prev => ({ ...prev, adjustment: e.target.value }))} className="w-24 border border-gray-300 rounded text-right px-3 py-1.5 text-sm outline-none bg-white" placeholder="0.00" />
                      <span className="text-gray-900 font-medium w-20 text-right">{formatCurrency(adjustment)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-5 border-t border-gray-200 mt-2">
                    <span className="text-base font-bold text-gray-900">Total ( ₹ )</span>
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white border-t border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center z-[60] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="flex gap-3">
                <button onClick={() => handleSaveQuotation(false)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
                  {saving && !form.isSubmit ? "Saving..." : "Save as Draft"}
                </button>
                <button onClick={() => handleSaveQuotation(true)} disabled={saving} className="bg-gray-100 border border-gray-300 text-gray-800 hover:bg-gray-200 px-5 py-2 rounded-md text-sm font-medium transition-colors">
                  {saving && form.isSubmit ? "Saving..." : editingId ? "Update & Submit" : "Save and Submit"}
                </button>
                <button onClick={() => setOpen(false)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-5 py-2 rounded-md text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                PDF Template: <span className="font-medium text-gray-800">Truflow Final</span> <a href="#" className="text-blue-600 hover:underline">Change</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}