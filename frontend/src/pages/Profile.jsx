import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  UserRound,
  MapPin,
  KeyRound,
  Plus,
  Trash2,
  Check,
  Loader2,
  Pencil,
  X,
  ShieldCheck,
} from "lucide-react";

import {
  getMe,
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
} from "../api/authApi";
import useAuthStore from "../store/authStore";
import { useToast } from "../components/ui/Toast";

const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-sand-900 transition placeholder:text-sand-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

const emptyAddressForm = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export default function Profile() {
  const toast = useToast();

  const setUser = useAuthStore((s) => s.setUser);

  const [profile, setProfile] = useState({ name: "", phone: "" });
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [savingProfile, setSavingProfile] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [editingId, setEditingId] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);

  const load = async () => {
    try {
      setLoading(true);

      const user = await getMe();
      setUser(user);
      setProfile({ name: user.name || "", phone: user.phone || "" });
      setAddresses(user.addresses || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const updated = await updateProfile(profile);
      setUser(updated);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);

    try {
      await changePassword(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setSavingAddress(true);

    try {
      if (editingId) {
        const updated = await updateAddress(editingId, addressForm);
        setAddresses(updated);
        toast.success("Address updated");
      } else {
        const updated = await addAddress(addressForm);
        setAddresses(updated);
        toast.success("Address added");
      }

      setShowAddressForm(false);
      setEditingId(null);
      setAddressForm(emptyAddressForm);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm("Remove this address?")) return;

    try {
      const updated = await deleteAddress(id);
      setAddresses(updated);
      toast.success("Address removed");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startEdit = (address) => {
    setAddressForm({
      label: address.label || "Home",
      fullName: address.fullName || "",
      phone: address.phone || "",
      line1: address.line1 || "",
      line2: address.line2 || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
    });
    setEditingId(address._id);
    setShowAddressForm(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={30} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <section className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            Your account
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
            Profile &amp; settings
          </h1>
        </motion.div>

        <div className="mt-10 space-y-6">
          {/* Personal details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="card p-6"
          >
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-sand-900">
              <UserRound size={19} className="text-brand-600" />
              Personal details
            </h2>

            <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-sand-700">Name</label>
                  <input
                    required
                    value={profile.name}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, name: e.target.value }))
                    }
                    className={`mt-1.5 ${field}`}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Phone number
                  </label>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    className={`mt-1.5 ${field}`}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-sand-700">Email</label>
                <input
                  value={useAuthStore.getState().user?.email || ""}
                  disabled
                  className={`mt-1.5 ${field} cursor-not-allowed bg-sand-100 text-sand-400`}
                />
                <p className="mt-1.5 text-xs text-sand-400">
                  Email can't be changed. Contact us if you need it updated.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {savingProfile && <Loader2 size={15} className="animate-spin" />}
                Save changes
              </button>
            </form>
          </motion.div>

          {/* Addresses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-sand-900">
                <MapPin size={19} className="text-brand-600" />
                Delivery addresses
              </h2>

              {!showAddressForm && (
                <button
                  onClick={() => {
                    setAddressForm(emptyAddressForm);
                    setEditingId(null);
                    setShowAddressForm(true);
                  }}
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition hover:text-brand-800"
                >
                  <Plus size={15} />
                  Add address
                </button>
              )}
            </div>

            {addresses.length === 0 && !showAddressForm && (
              <p className="mt-5 text-sm text-sand-500">
                You haven't saved an address yet. Add one to check out faster.
              </p>
            )}

            {addresses.length > 0 && (
              <ul className="mt-5 space-y-3">
                {addresses.map((address) => (
                  <li
                    key={address._id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-sand-200 p-4"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-bold text-sand-900">
                        {address.label}
                        {address.isDefault && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-sand-600">{address.fullName}</p>
                      <p className="text-sm text-sand-500">
                        {[
                          address.line1,
                          address.line2,
                          address.city,
                          address.state,
                          address.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {address.phone && (
                        <p className="mt-1 text-sm text-sand-500">{address.phone}</p>
                      )}
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startEdit(address)}
                        className="rounded-lg p-2 text-sand-400 transition hover:bg-sand-100 hover:text-brand-700"
                        aria-label="Edit address"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(address._id)}
                        className="rounded-lg p-2 text-sand-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete address"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {showAddressForm && (
              <form onSubmit={handleSaveAddress} className="mt-5 space-y-4 rounded-2xl bg-sand-50 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sand-900">
                    {editingId ? "Edit address" : "New address"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddressForm(false);
                      setEditingId(null);
                    }}
                    className="rounded-lg p-1.5 text-sand-400 transition hover:bg-sand-200"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">Label</label>
                    <input
                      value={addressForm.label}
                      onChange={(e) =>
                        setAddressForm((p) => ({ ...p, label: e.target.value }))
                      }
                      placeholder="Home, Farm, Shop…"
                      className={`mt-1.5 ${field}`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Receiver's name
                    </label>
                    <input
                      required
                      value={addressForm.fullName}
                      onChange={(e) =>
                        setAddressForm((p) => ({ ...p, fullName: e.target.value }))
                      }
                      className={`mt-1.5 ${field}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">Phone</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={addressForm.phone}
                    onChange={(e) =>
                      setAddressForm((p) => ({
                        ...p,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    className={`mt-1.5 ${field}`}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Address line 1
                  </label>
                  <input
                    required
                    value={addressForm.line1}
                    onChange={(e) =>
                      setAddressForm((p) => ({ ...p, line1: e.target.value }))
                    }
                    className={`mt-1.5 ${field}`}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Address line 2
                  </label>
                  <input
                    value={addressForm.line2}
                    onChange={(e) =>
                      setAddressForm((p) => ({ ...p, line2: e.target.value }))
                    }
                    className={`mt-1.5 ${field}`}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">City</label>
                    <input
                      required
                      value={addressForm.city}
                      onChange={(e) =>
                        setAddressForm((p) => ({ ...p, city: e.target.value }))
                      }
                      className={`mt-1.5 ${field}`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">State</label>
                    <input
                      required
                      value={addressForm.state}
                      onChange={(e) =>
                        setAddressForm((p) => ({ ...p, state: e.target.value }))
                      }
                      className={`mt-1.5 ${field}`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">Pincode</label>
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={addressForm.pincode}
                      onChange={(e) =>
                        setAddressForm((p) => ({
                          ...p,
                          pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                      className={`mt-1.5 ${field}`}
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-sand-600">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault || false}
                    onChange={(e) =>
                      setAddressForm((p) => ({ ...p, isDefault: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-sand-300 text-brand-600 focus:ring-brand-400"
                  />
                  Set as my default address
                </label>

                <button
                  type="submit"
                  disabled={savingAddress}
                  className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {savingAddress && <Loader2 size={15} className="animate-spin" />}
                  <Check size={15} />
                  Save address
                </button>
              </form>
            )}
          </motion.div>

          {/* Password */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="card p-6"
          >
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-sand-900">
              <KeyRound size={19} className="text-brand-600" />
              Change password
            </h2>

            <form onSubmit={handleChangePassword} className="mt-5 max-w-md space-y-4">
              <div>
                <label className="text-sm font-semibold text-sand-700">
                  Current password
                </label>
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, currentPassword: e.target.value }))
                  }
                  className={`mt-1.5 ${field}`}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-sand-700">
                  New password
                </label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, newPassword: e.target.value }))
                  }
                  className={`mt-1.5 ${field}`}
                  placeholder="At least 8 characters"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {savingPassword && <Loader2 size={15} className="animate-spin" />}
                Update password
              </button>
            </form>
          </motion.div>

          {/* Security note */}
          <div className="flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-brand-600" />
            <p className="text-sm text-brand-800">
              Your password is stored securely as a one-way hash. We never store or
              email your plain-text password.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
