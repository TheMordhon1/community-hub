import { motion } from "framer-motion";
import { format, isToday } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Users,
  Clock,
  Edit,
  Trash2,
  Check,
  Trophy,
  CalendarIcon,
} from "lucide-react";
import { formatEventTime, cn } from "@/lib/utils";
import type { Event, EventRsvp } from "@/types/database";

interface EventCardProps {
  event: Event;
  index: number;
  isPast?: boolean;
  rsvps: EventRsvp[];
  userId: string | undefined;
  canEdit: boolean;
  canDelete: boolean;
  isRsvpPending: boolean;
  onRsvp: (eventId: string, isAttending: boolean) => void;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}

export function EventCard({
  event,
  index,
  isPast = false,
  rsvps,
  userId,
  canEdit,
  canDelete,
  isRsvpPending,
  onRsvp,
  onEdit,
  onDelete,
}: EventCardProps) {
  const isAttending = rsvps.some((r) => r.event_id === event.id && r.user_id === userId);
  const attendeeCount = rsvps.filter((r) => r.event_id === event.id && r.status === "attending").length;

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/events/${event.id}`}>
        <Card
          className={cn(
            "overflow-hidden hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col",
            isPast && "opacity-60"
          )}
        >
          {/* Image / Date Header */}
          {event.image_url ? (
            <div className="relative w-full h-60 shrink-0 overflow-hidden">
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-fill group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r" />
              <div className="absolute bottom-2 left-2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 text-center">
                <span className="text-2xl font-bold text-white drop-shadow-lg">
                  {format(new Date(event.event_date), "d")}
                </span>
                <span className="block text-xs text-white uppercase drop-shadow-lg">
                  {format(new Date(event.event_date), "MMMM", { locale: idLocale })}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-60 bg-primary/10 flex flex-col items-center justify-center p-3 text-center shrink-0">
              <span className="text-2xl font-bold text-primary">
                {format(new Date(event.event_date), "d")}
              </span>
              <span className="text-xs text-primary uppercase">
                {format(new Date(event.event_date), "MMMM", { locale: idLocale })}
              </span>
            </div>
          )}

          {/* Body */}
          <div className="flex flex-col justify-between gap-4 flex-1 p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg line-clamp-1">{event.title}</h3>
                {event.event_type === "competition" && (
                  <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                    <Trophy className="w-3 h-3" /> Kompetisi
                  </Badge>
                )}
                {isPast && <Badge variant="secondary">Selesai</Badge>}
                {isToday(new Date(event.event_date)) && !isPast && (
                  <Badge variant="default">Hari ini</Badge>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              {event.description && (
                <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{event.description}</p>
              )}
              <div className="flex flex-col md:flex-row mt-auto md:items-center gap-2 md:gap-4 text-sm text-muted-foreground">
                {event.event_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatEventTime(event.event_time)}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1 max-w-52">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="line-clamp-1 w-full">{event.location}</span>
                  </span>
                )}
                <span className="flex items-center gap-1 shrink-0">
                  <Users className="w-3 h-3" /> {attendeeCount} warga
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-auto">
              {!isPast && (
                <Button
                  variant={isAttending ? "default" : "outline"}
                  size="sm"
                  className="w-full hover:bg-success"
                  onClick={(e) => {
                    e.preventDefault();
                    onRsvp(event.id, isAttending);
                  }}
                  disabled={isRsvpPending}
                >
                  {isAttending ? (
                    <><Check className="w-4 h-4 mr-1" /> Hadir</>
                  ) : (
                    "Ikuti Acara"
                  )}
                </Button>
              )}
              {canEdit && !isPast && (
                <Button
                  variant="ghost"
                  className="hover:bg-white transition hover:scale-125"
                  size="icon"
                  onClick={(e) => { e.preventDefault(); onEdit(event); }}
                >
                  <Edit className="w-4 h-4" color="black" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  className="hover:bg-white transition hover:scale-125"
                  size="icon"
                  onClick={(e) => { e.preventDefault(); onDelete(event); }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyEventState({ message }: { message: string }) {
  return (
    <Card className="py-8 bg-muted/30 border-dashed">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <CalendarIcon className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
