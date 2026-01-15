import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, MessageCircle, Send, Mail, AlertTriangle, ExternalLink } from "lucide-react";
import {
  useActiveEmergencyContacts,
  getContactLink,
  EmergencyContact,
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

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "whatsapp":
        return <MessageCircle className="w-4 h-4" />;
      case "telegram":
        return <Send className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      case "phone":
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
      case "phone":
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
      case "phone":
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

  if (!contacts || contacts.length === 0) {
    return null;
  }

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
            <p className="text-muted-foreground text-lg">
              Hubungi nomor di bawah ini dalam keadaan darurat
            </p>
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
                <Card className="h-full border-red-200/50 hover:border-red-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-red-50/20">
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                      {getPlatformIcon(contact.platform)}
                      <span className="sr-only">{getPlatformLabel(contact.platform)}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-1 text-foreground">
                      {contact.name}
                    </h3>
                    {contact.description && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {contact.description}
                      </p>
                    )}
                    <a
                      href={getContactLink(contact.platform, contact.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button
                        className={`w-full ${getPlatformColor(contact.platform)}`}
                      >
                        {getPlatformIcon(contact.platform)}
                        <span className="ml-2">{contact.phone}</span>
                        <ExternalLink className="w-3 h-3 ml-2" />
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
            <CardTitle className="text-lg font-display">Kontak Darurat</CardTitle>
            <CardDescription>Hubungi dalam keadaan darurat</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    contact.platform === "whatsapp"
                      ? "bg-green-100 text-green-600"
                      : contact.platform === "telegram"
                      ? "bg-blue-100 text-blue-500"
                      : contact.platform === "email"
                      ? "bg-orange-100 text-orange-500"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {getPlatformIcon(contact.platform)}
                </div>
                <div>
                  <p className="font-medium text-sm">{contact.name}</p>
                  <p className="text-xs text-muted-foreground">{contact.phone}</p>
                </div>
              </div>
              <a
                href={getContactLink(contact.platform, contact.phone)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="sm"
                  className={getPlatformColor(contact.platform)}
                >
                  {getPlatformIcon(contact.platform)}
                  <span className="ml-1 hidden sm:inline">
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
