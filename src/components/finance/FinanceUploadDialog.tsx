import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Download } from "lucide-react";
import { useFinanceUpload } from "@/hooks/finance/useFinanceUpload";
import { useFinanceExport } from "@/hooks/finance/useFinanceExport";

interface FinanceUploadDialogProps {
  ledgerType: "umum" | "donasi";
  CATEGORIES: {
    income: string[];
    outcome: string[];
    donation: string[];
    donation_outcome: string[];
  };
  isUploadOpen: boolean;
  setIsUploadOpen: (open: boolean) => void;
}

export function FinanceUploadDialog({
  ledgerType,
  CATEGORIES,
  isUploadOpen,
  setIsUploadOpen,
}: FinanceUploadDialogProps) {
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [isConfirmUploadOpen, setIsConfirmUploadOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { downloadTemplate } = useFinanceExport();
  const { processExcelUpload, isUploadLoading } = useFinanceUpload();

  const handleDownloadTemplate = () => {
    downloadTemplate({ ledgerType, CATEGORIES });
  };

  const resetUploadState = () => {
    setSelectedExcelFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsUploadOpen(false);
    setIsConfirmUploadOpen(false);
  };

  const handleProcessUpload = () => {
    processExcelUpload({
      ledgerType,
      selectedExcelFile,
      CATEGORIES,
      onSuccess: resetUploadState,
    });
  };

  return (
    <>
      <Dialog
        open={isUploadOpen}
        onOpenChange={(open) => {
          setIsUploadOpen(open);
          if (!open) resetUploadState();
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ledgerType === "umum"
                ? "Upload Data Keuangan dari Excel"
                : "Upload Data Donasi dari Excel"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload file Excel dengan format sesuai template.
            </p>

            <div className="p-3 bg-muted rounded-md text-sm">
              Data akan diupload ke:{" "}
              <strong>
                {ledgerType === "umum"
                  ? "Laporan Keuangan Umum"
                  : "Laporan Donasi"}
              </strong>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <div className="space-y-2">
              <Label>Pilih File Excel</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedExcelFile(file);
                }}
                disabled={isUploadLoading}
              />
            </div>

            {selectedExcelFile && (
              <Button
                className="w-full"
                onClick={() => setIsConfirmUploadOpen(true)}
                disabled={isUploadLoading}
              >
                Lanjutkan Upload
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isConfirmUploadOpen}
        onOpenChange={setIsConfirmUploadOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Upload Excel</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan mengupload file <strong>{selectedExcelFile?.name}</strong>{" "}
              ke{" "}
              <strong>
                {ledgerType === "umum"
                  ? "Laporan Keuangan Umum"
                  : "Laporan Donasi"}
              </strong>
              . Apakah Anda yakin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploadLoading}>
              Batal
            </AlertDialogCancel>
            <Button onClick={handleProcessUpload} disabled={isUploadLoading}>
              {isUploadLoading && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Upload Sekarang
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
