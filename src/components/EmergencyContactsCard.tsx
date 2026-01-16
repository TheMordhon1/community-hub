import { useState } from "react"; // Added for copy feedback
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  MessageCircle,
  Send,
  Mail,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import {
  useActiveEmergencyContacts,
  getContactLink,
} from "@/hooks/useEmergencyContacts";

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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "whatsapp":
        return <MessageCircle className="w-4 h-4" />;
      case "telegram":
        return <Send className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      default:
        return <Phone className="w-4 h-4" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "whatsapp":
        return "bg-green-600 hover:bg-green-700 text-white";
      case "telegram":
        return "bg-blue-500 hover:bg-blue-600 text-white";
      case "email":
        return "bg-orange-500 hover:bg-orange-600 text-white";
      default:
        return "bg-primary hover:bg-primary/90 text-primary-foreground";
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case "whatsapp":
        return "WhatsApp";
      case "telegram":
        return "Telegram";
      case "email":
        return "Email";
      default:
        return "Telepon";
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!contacts || contacts.length === 0) return null;

  if (variant === "landing") {
    return (
      <section className={`py-16 md:py-24 ${className}`}>
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full mb-4">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">Kontak Darurat</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-emerald-900 mb-2">
              Nomor Darurat
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {contacts.map((contact, index) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full border-red-200/50 hover:border-red-300 hover:shadow-xl transition-all">
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-4 shadow-lg text-white">
                      {getPlatformIcon(contact.platform)}
                    </div>
                    <h3 className="font-bold text-lg mb-1">{contact.name}</h3>

                    {/* Copyable Number Row */}
                    <div
                      className="flex items-center gap-2 mb-4 group cursor-pointer"
                      onClick={() => handleCopy(contact.phone, contact.id)}
                    >
                      <span className="font-mono font-bold text-red-600">
                        {contact.phone}
                      </span>
                      {copiedId === contact.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </div>

                    <a
                      href={getContactLink(contact.platform, contact.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button
                        className={`w-full ${getPlatformColor(
                          contact.platform
                        )}`}
                      >
                        Hubungi {getPlatformLabel(contact.platform)}
                      </Button>
                    </a>
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
    <Card className={`border-red-200/50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-display">
              Kontak Darurat
            </CardTitle>
            <CardDescription>
              Daftar kontak jika dalam keadaan darurat
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg hidden sm:flex items-center justify-center ${
                    contact.platform === "whatsapp"
                      ? "bg-green-100 text-green-600"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {getPlatformIcon(contact.platform)}
                </div>
                <div className="grid gap-2">
                  <div>
                    <p className="font-medium text-sm">{contact.name}</p>
                    <p className="font-medium text-xs text-gray-400">
                      {contact.description}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => handleCopy(contact.phone, contact.id)}
                  >
                    <span className="font-bold text-sm text-black">
                      {contact.phone}
                    </span>
                    {copiedId === contact.id ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-muted-foreground transition-all" />
                    )}
                  </div>
                </div>
              </div>
              <a
                href={getContactLink(contact.platform, contact.phone)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="sm"
                  className={`${getPlatformColor(contact.platform)} w-full`}
                >
                  {getPlatformIcon(contact.platform)}
                  <span className="inline">
                    {getPlatformLabel(contact.platform)}
                  </span>
                </Button>
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
