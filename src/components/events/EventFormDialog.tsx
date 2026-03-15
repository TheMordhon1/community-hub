import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Loader2, ImagePlus, X, PartyPopper, Trophy } from "lucide-react";
import { TimePickerField } from "@/components/TimePickerDialog";
import type { Event, EventType } from "@/types/database";
import type { useEventForm } from "@/hooks/events/useEventMutations";

interface EventFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingEvent: Event | null;
  form: ReturnType<typeof useEventForm>;
  onSubmit: () => void;
  isLoading: boolean;
}

export function EventFormDialog({
  isOpen,
  onOpenChange,
  editingEvent,
  form,
  onSubmit,
  isLoading,
}: EventFormDialogProps) {
  const {
    title, setTitle,
    description, setDescription,
    location, setLocation,
    eventDate, setEventDate,
    eventTime, setEventTime,
    eventType, setEventType,
    imagePreview,
    fileInputRef,
    handleImageChange,
    removeImage,
    resetForm,
  } = form;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="w-12 h-12 rounded-full fixed bottom-4 right-4 md:rounded-sm md:static flex md:w-auto md:h-auto justify-center items-center z-50">
          <Plus className="w-8 md:w-4 md:h-4 md:mr-2 mx-auto" />
          <span className="hidden md:block">Buat Acara</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingEvent ? "Edit Acara" : "Buat Acara Baru"}</DialogTitle>
          <DialogDescription>Isi detail acara di bawah ini</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-auto px-1">
          {/* Event Type */}
          <div className="space-y-2">
            <Label>Tipe Acara</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["regular", "competition"] as EventType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventType(type)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    eventType === type ? "border-primary bg-primary/10" : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  {type === "regular"
                    ? <PartyPopper className={cn("w-8 h-8", eventType === type ? "text-primary" : "text-muted-foreground")} />
                    : <Trophy className={cn("w-8 h-8", eventType === type ? "text-primary" : "text-muted-foreground")} />
                  }
                  <div className="text-center">
                    <p className={cn("font-medium text-sm", eventType === type ? "text-primary" : "text-foreground")}>
                      {type === "regular" ? "Acara Biasa" : "Kompetisi"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {type === "regular" ? "Kegiatan, rapat, dll" : "Lomba, turnamen, dll"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Judul Acara</Label>
            <Input id="title" placeholder="Judul acara" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea id="description" placeholder="Deskripsi acara..." rows={10} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Lokasi</Label>
            <Input id="location" placeholder="Lokasi acara" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Tanggal</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, "d MMM yyyy", { locale: idLocale }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={setEventDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <TimePickerField id="time" label="Jam" optional value={eventTime} onChange={setEventTime} />

          {/* Image */}
          <div className="space-y-2">
            <Label>Gambar (opsional)</Label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden">
                <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={removeImage}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full h-24 border-dashed" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="w-6 h-6 mr-2" /> Tambah Gambar
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse md:flex-row gap-4 items-center md:justify-end">
          <Button variant="outline" onClick={resetForm} className="w-full hover:bg-secondary">Batal</Button>
          <Button onClick={onSubmit} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingEvent ? "Simpan" : "Buat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
