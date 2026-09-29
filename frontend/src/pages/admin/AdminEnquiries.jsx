import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  MailOpen,
  Trash2,
  Loader2,
  Package,
  Phone,
  Archive,
  Reply,
} from "lucide-react";

import {
  getEnquiries,
  updateEnquiryStatus,
  deleteEnquiry,
} from "../../api/enquiryApi";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { ENQUIRY_STATUS } from "../../components/ui/Badge";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import business from "../../config/business";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "archived", label: "Archived" },
];

export default function AdminEnquiries() {
  const toast = useToast();

  const [enquiries, setEnquiries] = useState([]);
  const [unread, setUnread] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);

      const data = await getEnquiries({ page, limit: 20, status });

      setEnquiries(data.enquiries || []);
      setUnread(data.unread ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const setEnquiryStatus = async (id, newStatus) => {
    setBusyId(id);

    try {
      await updateEnquiryStatus(id, newStatus);

      setEnquiries((current) =>
        current.map((e) => (e._id === id ? { ...e, status: newStatus } : e))
      );

      if (newStatus !== "new") {
        setUnread((n) => Math.max(0, n - 1));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this enquiry permanently?")) return;

    try {
      await deleteEnquiry(id);
      setEnquiries((current) => current.filter((e) => e._id !== id));
      toast.success("Enquiry deleted");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const mailto = (enquiry) =>
    `mailto:${enquiry.email}?subject=${encodeURIComponent(
      `Re: ${enquiry.subject}`
    )}&body=${encodeURIComponent(
      `Hello ${enquiry.name},\n\nThank you for your enquiry about "${
        enquiry.product?.name || "our products"
      }".\n\n\n\n\nBest regards,\n${business.name}`
    )}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Enquiries</h1>
          <p className="mt-1 text-sm text-sand-500">
            Messages sent from the contact form and product pages
          </p>
        </div>

        {unread > 0 && (
          <span className="rounded-full bg-clay-500 px-3 py-1.5 text-xs font-bold text-white">
            {unread} new
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              status === filter.value
                ? "bg-brand-700 text-white"
                : "bg-white text-sand-600 ring-1 ring-sand-200 hover:bg-sand-50"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : enquiries.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No enquiries"
          message="Messages from the contact form will land here."
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {enquiries.map((enquiry) => {
              const meta = ENQUIRY_STATUS[enquiry.status] ?? ENQUIRY_STATUS.new;
              const isNew = enquiry.status === "new";

              return (
                <motion.div
                  key={enquiry._id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className={`card p-5 ${isNew ? "border-l-4 border-l-clay-500" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-sand-900">{enquiry.name}</h2>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            isNew
                              ? "bg-clay-50 text-clay-700"
                              : "bg-sand-100 text-sand-600"
                          }`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sand-500">
                        <a
                          href={`mailto:${enquiry.email}`}
                          className="flex items-center gap-1.5 transition hover:text-brand-700"
                        >
                          <Mail size={12} />
                          {enquiry.email}
                        </a>

                        {enquiry.phone && (
                          <a
                            href={`tel:${enquiry.phone}`}
                            className="flex items-center gap-1.5 transition hover:text-brand-700"
                          >
                            <Phone size={12} />
                            {enquiry.phone}
                          </a>
                        )}

                        <span>
                          {new Date(enquiry.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {enquiry.product && (
                      <span className="flex items-center gap-1.5 rounded-lg bg-sand-100 px-2.5 py-1.5 text-xs font-semibold text-sand-600">
                        <Package size={13} />
                        {enquiry.product.name}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 font-semibold text-sand-800">{enquiry.subject}</p>

                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-sand-600">
                    {enquiry.message}
                  </p>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-sand-100 pt-4">
                    {isNew && (
                      <button
                        onClick={() => setEnquiryStatus(enquiry._id, "read")}
                        disabled={busyId === enquiry._id}
                        className="flex items-center gap-1.5 rounded-xl bg-sand-100 px-3.5 py-2 text-xs font-semibold text-sand-700 transition hover:bg-sand-200 disabled:opacity-50"
                      >
                        {busyId === enquiry._id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <MailOpen size={13} />
                        )}
                        Mark as read
                      </button>
                    )}

                    <a
                      href={mailto(enquiry)}
                      onClick={() => setEnquiryStatus(enquiry._id, "replied")}
                      className="flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-800"
                    >
                      <Reply size={13} />
                      Reply by email
                    </a>

                    {enquiry.status !== "archived" && (
                      <button
                        onClick={() => setEnquiryStatus(enquiry._id, "archived")}
                        disabled={busyId === enquiry._id}
                        className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-sand-500 transition hover:bg-sand-100 hover:text-sand-800 disabled:opacity-50"
                      >
                        <Archive size={13} />
                        Archive
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(enquiry._id)}
                      className="ml-auto flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-sand-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
    </div>
  );
}
