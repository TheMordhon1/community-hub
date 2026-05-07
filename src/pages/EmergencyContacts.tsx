import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  useEmergencyContacts,
  useCreateEmergencyContact,
  useUpdateEmergencyContact,
  useDeleteEmergencyContact,
  PLATFORM_OPTIONS,
  EmergencyContact,
  getContactLink,
  getContactPhones,
} from "@/hooks/useEmergencyContacts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Search, ExternalLink, ArrowLeft, X } from "lucide-react";
import { DynamicIcon } from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function EmergencyContacts() {
  const { isAdmin, isPengurus } = useAuth();
  const canManage = isAdmin() || isPengurus();
  const { data: contacts, isLoading } = useEmergencyContacts();
  const createContact = useCreateEmergencyContact();
  const updateContact = useUpdateEmergencyContact();
  const deleteContact = useDeleteEmergencyContact();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<EmergencyContact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);
  const [platform, setPlatform] = useState("phone");
  const [description, setDescription] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setName("");
    setPhones([""]);
    setPlatform("phone");
    setDescription("");
    setOrderIndex(0);
    setIsActive(true);
    setEditingContact(null);
  };

  const handleOpenDialog = (contact?: EmergencyContact) => {
    if (contact) {
      setEditingContact(contact);
      setName(contact.name);
      const list = getContactPhones(contact);
      setPhones(list.length > 0 ? list : [""]);
      setPlatform(contact.platform);
      setDescription(contact.description || "");
      setOrderIndex(contact.order_index);
      setIsActive(contact.is_active);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const updatePhoneAt = (index: number, value: string) => {
    setPhones((prev) => prev.map((p, i) => (i === index ? value : p)));
  };
  const addPhoneField = () => setPhones((prev) => [...prev, ""]);
  const removePhoneAt = (index: number) =>
    setPhones((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const handleSubmit = async () => {
    const cleanedPhones = phones.map((p) => p.trim()).filter(Boolean);
    if (!name.trim() || cleanedPhones.length === 0) return;

    const contactData = {
      name: name.trim(),
      phone: cleanedPhones[0],
      phones: cleanedPhones,
      platform,
      description: description.trim() || null,
      order_index: orderIndex,
      is_active: isActive,
    };

    if (editingContact) {
      await updateContact.mutateAsync({ id: editingContact.id, ...contactData });
    } else {
      await createContact.mutateAsync(contactData);
    }
    handleCloseDialog();
  };

  const handleDelete = async () => {
    if (contactToDelete) {
      await deleteContact.mutateAsync(contactToDelete.id);
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  const handleToggleActive = async (contact: EmergencyContact) => {
    await updateContact.mutateAsync({ id: contact.id, is_active: !contact.is_active });
  };

  const filteredContacts = contacts?.filter(contact => 
    (contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     contact.phone.includes(searchQuery) ||
     contact.description?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (canManage || contact.is_active)
  ).sort((a, b) => a.order_index - b.order_index);

  const getPlatformStyles = (platformValue: string) => {
    switch (platformValue) {
      case "whatsapp":
        return "bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/20";
      case "telegram":
        return "bg-[#0088cc]/10 text-[#0088cc] border-[#0088cc]/20";
      case "email":
        return "bg-[#EA4335]/10 text-[#EA4335] border-[#EA4335]/20";
      case "phone":
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h1 className="font-display text-3xl font-bold tracking-tight">Kontak Darurat</h1>
              <p className="text-muted-foreground mt-1 text-lg">
                Respons cepat untuk keamanan dan kenyamanan warga
              </p>
            </motion.div>
          </div>
          {canManage && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button onClick={() => handleOpenDialog()} size="lg" className="w-full md:w-auto shadow-lg hover:shadow-xl transition-all">
                <Plus className="w-5 h-5 mr-2" />
                Tambah Kontak
              </Button>
            </motion.div>
          )}
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Cari nama, nomor, atau deskripsi..." 
            className="pl-12 h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredContacts && filteredContacts.length > 0 ? (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredContacts.map((contact) => (
                <motion.div
                  key={contact.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className={cn(
                    "overflow-hidden h-full border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300",
                    !contact.is_active && "opacity-60 grayscale-[0.5]"
                  )}>
                    <CardHeader className="p-5 flex flex-row items-start justify-between space-y-0">
                      <div className="space-y-1.5 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl font-bold line-clamp-1">{contact.name}</CardTitle>
                          {!contact.is_active && (
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Nonaktif</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                          {contact.description || "Tidak ada deskripsi"}
                        </p>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm shrink-0",
                        getPlatformStyles(contact.platform)
                      )}>
                        <DynamicIcon name={PLATFORM_OPTIONS.find(p => p.value === contact.platform)?.icon || "Phone"} className="w-6 h-6" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-6">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Informasi Kontak</span>
                        <div className="space-y-1">
                          {getContactPhones(contact).map((p, i) => (
                            <p key={i} className="text-xl font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100">{p}</p>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        {getContactPhones(contact).map((p, i) => (
                          <Button
                            key={i}
                            asChild
                            className="w-full h-12 rounded-xl text-base font-semibold shadow-md active:scale-95 transition-transform"
                          >
                            <a href={getContactLink(contact.platform, p)} target="_blank" rel="noopener noreferrer">
                              Hubungi {getContactPhones(contact).length > 1 ? p : "Sekarang"}
                              <ExternalLink className="w-4 h-4 ml-2" />
                            </a>
                          </Button>
                        ))}
                        
                        {canManage && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              className="h-12 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-primary/10 dark:hover:bg-slate-800 font-medium"
                              onClick={() => handleOpenDialog(contact)}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Ubah
                            </Button>
                            <Button
                              variant="outline"
                              className="h-12 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-red-100 dark:hover:bg-red-950/30 text-destructive font-medium"
                              onClick={() => {
                                setContactToDelete(contact);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Hapus
                            </Button>
                          </div>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={contact.is_active}
                              onCheckedChange={() => handleToggleActive(contact)}
                              id={`active-${contact.id}`}
                            />
                            <Label htmlFor={`active-${contact.id}`} className="text-sm font-medium cursor-pointer">
                              {contact.is_active ? "Terpublikasi" : "Draft"}
                            </Label>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">Urutan: {contact.order_index}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700"
          >
            <div className="max-w-xs mx-auto space-y-4">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold">Tidak ada kontak ditemukan</h3>
              <p className="text-muted-foreground lowercase">Coba gunakan kata kunci lain atau tambahkan kontak baru.</p>
              {canManage && (
                <Button onClick={() => handleOpenDialog()} variant="secondary">
                  Tambah Kontak Pertama
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {editingContact ? "Perbarui Kontak" : "Kontak Baru"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Berikan informasi kontak darurat yang akurat untuk warga.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Nama Kontak *</Label>
              <Input
                id="name"
                placeholder="Contoh: Satpam Pos 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="platform" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {PLATFORM_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <DynamicIcon name={option.icon} className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Nomor / User *</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addPhoneField} className="h-8 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Nomor
                </Button>
              </div>
              <div className="space-y-2">
                {phones.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="+62..."
                      value={p}
                      onChange={(e) => updatePhoneAt(i, e.target.value)}
                      className="h-12 rounded-xl font-mono flex-1"
                    />
                    {phones.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removePhoneAt(i)}
                        className="h-12 w-12 rounded-xl shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Deskripsi Singkat</Label>
              <Textarea
                id="description"
                placeholder="Jelaskan peran atau area tugas kontak ini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div className="space-y-2">
                <Label htmlFor="orderIndex" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Urutan Tampil</Label>
                <Input
                  id="orderIndex"
                  type="number"
                  min={0}
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(parseInt(e.target.value) || 0)}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Visibilitas</Label>
                <div className="flex items-center gap-3 pt-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} id="form-active" />
                  <Label htmlFor="form-active" className="text-sm font-medium cursor-pointer">
                    {isActive ? "Publikasikan" : "Simpan Draft"}
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleCloseDialog} className="flex-1 sm:flex-none">
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 sm:flex-none px-8"
              disabled={
                !name.trim() ||
                phones.every((p) => !p.trim()) ||
                createContact.isPending ||
                updateContact.isPending
              }
            >
              {editingContact ? "Simpan Perubahan" : "Terbitkan Kontak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-destructive">Hapus Kontak Permanen?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Kontak <span className="font-bold text-slate-900 dark:text-slate-100">"{contactToDelete?.name}"</span> akan dihapus dari sistem. Warga tidak akan bisa melihat kontak ini lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl px-8"
            >
              Hapus Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
