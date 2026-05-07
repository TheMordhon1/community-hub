import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ExternalLink, ArrowRight, Copy, Check } from "lucide-react";
import {
  useActiveEmergencyContacts,
  getContactLink,
  getContactMethods,
  PLATFORM_OPTIONS,
} from "@/hooks/useEmergencyContacts";
import { Link } from "react-router-dom";
import { DynamicIcon } from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";

interface EmergencyContactsCardProps {
  variant?: "dashboard" | "landing";
  className?: string;
}

export function EmergencyContactsCard({
  variant = "dashboard",
  className = "",
}: EmergencyContactsCardProps) {
  const { data: contacts, isLoading } = useActiveEmergencyContacts();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { isAdmin, canManageContent } = useAuth();

  const handleCopy = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    toast.success("Nomor telepon disalin!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPlatformStyles = (platformValue: string) => {
    switch (platformValue) {
      case "whatsapp":
        return "bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/10";
      case "telegram":
        return "bg-[#0088cc]/10 text-[#0088cc] border-[#0088cc]/10";
      case "email":
        return "bg-[#EA4335]/10 text-[#EA4335] border-[#EA4335]/10";
      case "phone":
      default:
        return "bg-primary/10 text-primary border-primary/10";
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "whatsapp":
        return "bg-[#25D366] hover:bg-[#128C7E] text-white shadow-[#25D366]/20";
      case "telegram":
        return "bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-[#0088cc]/20";
      case "email":
        return "bg-[#EA4335] hover:bg-[#d93025] text-white shadow-[#EA4335]/20";
      case "phone":
      default:
        return "bg-primary hover:bg-primary/90 text-primary-foreground";
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("border-slate-200 dark:border-slate-800", className)}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!contacts || contacts.length === 0) {
    return null;
  }

  if (variant === "landing") {
    return (
      <section className={cn("py-16 md:py-24 bg-background", className)}>
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-600 px-4 py-2 rounded-full mb-4 border border-red-100 dark:border-red-900/50">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold tracking-tight">Kondisi Darurat</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-2 tracking-tight">
              Bantuan Cepat
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Hubungi layanan keamanan atau pengurus segera jika Anda memerlukan bantuan mendesak.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {contacts.map((contact, index) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full border-slate-200 dark:border-slate-800 hover:shadow-2xl transition-all group rounded-2xl overflow-hidden">
                  <CardContent className="p-8 flex flex-col items-center text-center">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner border",
                      getPlatformStyles(contact.platform)
                    )}>
                      <DynamicIcon name={PLATFORM_OPTIONS.find(p => p.value === contact.platform)?.icon || "Phone"} className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-xl mb-2 text-foreground">
                      {contact.name}
                    </h3>
                    {contact.description && (
                      <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[2.5rem]">
                        {contact.description}
                      </p>
                    )}
                    <div className="w-full space-y-2">
                      {getContactMethods(contact).map((m, i) => {
                        const opt = PLATFORM_OPTIONS.find((o) => o.value === m.platform);
                        return (
                          <a
                            key={i}
                            href={getContactLink(m.platform, m.value)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full"
                          >
                            <Button
                              className={cn(
                                "w-full h-12 rounded-xl font-bold shadow-lg transition-all active:scale-95",
                                getPlatformColor(m.platform)
                              )}
                            >
                              <DynamicIcon name={opt?.icon || "Phone"} className="w-4 h-4 mr-2" />
                              <span className="mr-2 truncate">{m.value}</span>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </a>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Dashboard variant
  return (
    <Card className={cn("border-red-100 dark:border-red-950/50 overflow-hidden shadow-md", className)}>
      <CardHeader className="pb-4 bg-red-50/50 dark:bg-red-950/20 border-b border-red-100/50 dark:border-red-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">Kontak Darurat</CardTitle>
              <CardDescription className="text-xs font-medium">Bantuan cepat 24/7</CardDescription>
            </div>
          </div>
          {(isAdmin() || canManageContent()) && (
            <Link to="/emergency-contacts">
              <Button variant="ghost" size="sm" className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50">
                Lihat Semua
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact, index) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="overflow-hidden border-slate-100 dark:border-slate-800 hover:shadow-md transition-all group h-full">
                <CardContent className="p-4 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <p className="font-bold text-sm tracking-tight group-hover:text-red-600 transition-colors uppercase line-clamp-1">{contact.name}</p>
                      <div className="space-y-1">
                        {getContactMethods(contact).map((m, i) => {
                          const opt = PLATFORM_OPTIONS.find((o) => o.value === m.platform);
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <DynamicIcon name={opt?.icon || "Phone"} className="w-3 h-3 text-muted-foreground shrink-0" />
                              <p className="text-[11px] font-mono font-medium text-muted-foreground tracking-wider truncate">{m.value}</p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                                onClick={() => handleCopy(`${contact.id}-${i}`, m.value)}
                              >
                                <AnimatePresence mode="wait" initial={false}>
                                  {copiedId === `${contact.id}-${i}` ? (
                                    <motion.div
                                      key="check"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      exit={{ scale: 0 }}
                                    >
                                      <Check className="w-3 h-3 text-green-600" />
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="copy"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      exit={{ scale: 0 }}
                                    >
                                      <Copy className="w-3 h-3 text-muted-foreground" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0",
                        getPlatformStyles(contact.platform)
                      )}
                    >
                      <DynamicIcon name={PLATFORM_OPTIONS.find(p => p.value === contact.platform)?.icon || "Phone"} className="w-5 h-5" />
                    </div>
                  </div>
                  
                  {contact.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mb-4 flex-1">
                      {contact.description}
                    </p>
                  )}
                  
                  <div className="mt-auto space-y-2">
                    {getContactPhones(contact).map((p, i) => (
                      <a
                        key={i}
                        href={getContactLink(contact.platform, p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button
                          size="sm"
                          className={cn(
                            "w-full h-9 rounded-lg shadow-sm transition-all active:scale-95 font-bold text-xs",
                            getPlatformColor(contact.platform)
                          )}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-2" />
                          Hubungi {getContactPhones(contact).length > 1 ? p : ""}
                        </Button>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
