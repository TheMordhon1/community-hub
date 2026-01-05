import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Mail, MessageCircle } from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  url: string;
  shareText: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  title,
  description = "Bagikan informasi ini ke orang lain",
  url,
  shareText,
}: ShareDialogProps) {
  const { toast } = useToast();

  const handleShare = async (method: "copy" | "whatsapp" | "email") => {
    const fullText = `${shareText}\n\n${url}`;

    switch (method) {
      case "copy":
        await navigator.clipboard.writeText(fullText);
        toast({
          title: "Berhasil",
          description: "Link berhasil disalin ke clipboard",
        });
        onOpenChange(false);
        break;
      case "whatsapp":
        window.open(
          `https://wa.me/?text=${encodeURIComponent(fullText)}`,
          "_blank"
        );
        break;
      case "email":
        window.location.href = `mailto:?subject=${encodeURIComponent(
          title
        )}&body=${encodeURIComponent(fullText)}`;
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bagikan</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            onClick={() => handleShare("copy")}
          >
            <Copy className="w-4 h-4 mr-2" />
            Salin Link
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            onClick={() => handleShare("whatsapp")}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Bagikan via WhatsApp
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            onClick={() => handleShare("email")}
          >
            <Mail className="w-4 h-4 mr-2" />
            Bagikan via Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
