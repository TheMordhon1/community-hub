import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import {
  useEmergencyContacts,
  useCreateEmergencyContact,
  useUpdateEmergencyContact,
  useDeleteEmergencyContact,
  PLATFORM_OPTIONS,
  EmergencyContact,
} from "@/hooks/useEmergencyContacts";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Phone, MessageCircle, Send, Mail } from "lucide-react";
import { DynamicIcon } from "@/components/DynamicIcon";

export default function EmergencyContacts() {
  const { isAdmin } = useAuth();
  const { data: contacts, isLoading } = useEmergencyContacts();
  const createContact = useCreateEmergencyContact();
  const updateContact = useUpdateEmergencyContact();
  const deleteContact = useDeleteEmergencyContact();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<EmergencyContact | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [platform, setPlatform] = useState("phone");
  const [description, setDescription] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const resetForm = () => {
    setName("");
    setPhone("");
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
      setPhone(contact.phone);
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

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) return;

    const contactData = {
      name: name.trim(),
      phone: phone.trim(),
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

  const getPlatformIcon = (platformValue: string) => {
    switch (platformValue) {
      case "whatsapp":
        return <MessageCircle className="w-4 h-4 text-green-600" />;
      case "telegram":
        return <Send className="w-4 h-4 text-blue-500" />;
      case "email":
        return <Mail className="w-4 h-4 text-orange-500" />;
      case "phone":
      default:
        return <Phone className="w-4 h-4 text-primary" />;
    }
  };

  const getPlatformLabel = (platformValue: string) => {
    return PLATFORM_OPTIONS.find((p) => p.value === platformValue)?.label || platformValue;
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="font-display text-2xl font-bold">Kontak Darurat</h1>
            <p className="text-muted-foreground">
              Kelola daftar kontak darurat untuk warga
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Kontak
          </Button>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Kontak Darurat</CardTitle>
            <CardDescription>
              Kontak yang dapat dihubungi dalam keadaan darurat
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : contacts && contacts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kontak</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.order_index}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          {contact.description && (
                            <p className="text-sm text-muted-foreground">
                              {contact.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{contact.phone}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(contact.platform)}
                          <span>{getPlatformLabel(contact.platform)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={contact.is_active}
                          onCheckedChange={() => handleToggleActive(contact)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(contact)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setContactToDelete(contact);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada kontak darurat. Klik "Tambah Kontak" untuk menambahkan.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Edit Kontak Darurat" : "Tambah Kontak Darurat"}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? "Perbarui informasi kontak darurat"
                : "Tambahkan kontak darurat baru"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Kontak *</Label>
              <Input
                id="name"
                placeholder="Contoh: Satpam Pos 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Nomor / Username *</Label>
              <Input
                id="phone"
                placeholder="Contoh: +6281234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                placeholder="Deskripsi singkat tentang kontak ini"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orderIndex">Urutan</Label>
                <Input
                  id="orderIndex"
                  type="number"
                  min={0}
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status Aktif</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <span className="text-sm text-muted-foreground">
                    {isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !name.trim() ||
                !phone.trim() ||
                createContact.isPending ||
                updateContact.isPending
              }
            >
              {editingContact ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kontak Darurat?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kontak "{contactToDelete?.name}"?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
