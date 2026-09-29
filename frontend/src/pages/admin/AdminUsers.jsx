import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Users,
  ShieldCheck,
  ShieldOff,
  Loader2,
  BadgeCheck,
} from "lucide-react";

import { getUsers, updateUser } from "../../api/adminApi";
import useAuthStore from "../../store/authStore";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

export default function AdminUsers() {
  const toast = useToast();
  const currentUserId = useAuthStore((s) => s.user?._id);

  const [users, setUsers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);

      const data = await getUsers({
        page,
        limit: 20,
        search: search || undefined,
        role,
      });

      setUsers(data.users || []);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, role]);

  const toggleActive = async (user) => {
    if (String(user._id) === String(currentUserId)) {
      toast.error("You can't deactivate your own account.");
      return;
    }

    setBusyId(user._id);

    try {
      const updated = await updateUser(user._id, { isActive: !user.isActive });

      setUsers((current) =>
        current.map((u) => (u._id === user._id ? { ...u, ...updated } : u))
      );

      toast.success(
        updated.isActive
          ? `${updated.name} can now log in`
          : `${updated.name} has been deactivated`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleRole = async (user) => {
    if (String(user._id) === String(currentUserId)) {
      toast.error("You can't change your own role.");
      return;
    }

    setBusyId(user._id);
    const newRole = user.role === "admin" ? "user" : "admin";

    try {
      const updated = await updateUser(user._id, { role: newRole });

      setUsers((current) =>
        current.map((u) => (u._id === user._id ? { ...u, ...updated } : u))
      );

      toast.success(
        newRole === "admin"
          ? `${updated.name} is now an admin`
          : `${updated.name} is now a regular customer`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Customers</h1>
        <p className="mt-1 text-sm text-sand-500">
          Registered accounts, admin access and activation
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:min-w-0 sm:flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email or phone…"
              className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by role"
            className="w-full rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm font-medium transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-40 sm:shrink-0"
          >
            <option value="all">All roles</option>
            <option value="user">Customers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-sand-200 bg-sand-50 text-xs font-bold uppercase tracking-wider text-sand-500">
                <tr>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-sand-100">
                {users.map((user) => {
                  const isSelf = String(user._id) === String(currentUserId);

                  return (
                    <motion.tr
                      key={user._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="transition hover:bg-sand-50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                            {(user.name || "?")[0].toUpperCase()}
                          </span>

                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold text-sand-900">
                              {user.name}
                              {isSelf && (
                                <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sand-500">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-sand-500">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-sand-600">{user.phone || "—"}</td>

                      <td className="px-5 py-3.5 text-sand-500">
                        {new Date(user.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                            user.role === "admin"
                              ? "bg-clay-50 text-clay-700"
                              : "bg-sand-100 text-sand-600"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.isActive
                              ? "bg-brand-50 text-brand-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {user.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => toggleRole(user)}
                            disabled={busyId === user._id || isSelf}
                            title={
                              isSelf
                                ? "You can't change your own role"
                                : user.role === "admin"
                                  ? "Remove admin access"
                                  : "Make admin"
                            }
                            className="rounded-lg p-2 text-sand-500 transition hover:bg-clay-50 hover:text-clay-700 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Toggle admin role for ${user.name}`}
                          >
                            {busyId === user._id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : user.role === "admin" ? (
                              <BadgeCheck size={16} />
                            ) : (
                              <ShieldOff size={16} />
                            )}
                          </button>

                          <button
                            onClick={() => toggleActive(user)}
                            disabled={busyId === user._id || isSelf}
                            title={
                              isSelf
                                ? "You can't deactivate yourself"
                                : user.isActive
                                  ? "Deactivate account"
                                  : "Reactivate account"
                            }
                            className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Toggle activation for ${user.name}`}
                          >
                            {user.isActive ? (
                              <ShieldOff size={16} />
                            ) : (
                              <ShieldCheck size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
    </div>
  );
}
