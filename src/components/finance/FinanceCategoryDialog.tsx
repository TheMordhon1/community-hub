import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import {
  useFinanceCategories,
  useAddFinanceCategory,
  useDeleteFinanceCategory,
  type FinanceCategory,
} from "@/hooks/finance/useFinanceCategories";

interface FinanceCategoryDialogProps {
  ledgerType: "umum" | "donasi";
  isCategoryOpen: boolean;
  setIsCategoryOpen: (open: boolean) => void;
}

export function FinanceCategoryDialog({
  ledgerType,
  isCategoryOpen,
  setIsCategoryOpen,
}: FinanceCategoryDialogProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<
    "income" | "outcome" | "donation" | "donation_outcome"
  >("income");

  useEffect(() => {
    setNewCategoryType(ledgerType === "umum" ? "income" : "donation");
  }, [ledgerType]);

  const { data: categoriesData } = useFinanceCategories();
  const addCategory = useAddFinanceCategory();
  const deleteCategory = useDeleteFinanceCategory();

  const CategoryRow = ({ cat }: { cat: FinanceCategory }) => (
    <div
      key={cat.id}
      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
    >
      <span className="text-sm capitalize">{cat.name}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive"
        onClick={() => deleteCategory.mutate(cat.id)}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );

  return (
    <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola Kategori Keuangan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Add new category */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nama Kategori</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nama kategori baru"
              />
            </div>
            <div className="w-[180px] space-y-1">
              <Label className="text-xs">Jenis</Label>
              <Select
                value={newCategoryType}
                onValueChange={(v: "income" | "outcome" | "donation" | "donation_outcome") =>
                  setNewCategoryType(v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ledgerType === "umum" ? (
                    <>
                      <SelectItem value="income">Pemasukan</SelectItem>
                      <SelectItem value="outcome">Pengeluaran</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="donation">Uang Masuk Donasi</SelectItem>
                      <SelectItem value="donation_outcome">Pengeluaran Donasi</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!newCategoryName.trim()) return;
                addCategory.mutate(
                  { name: newCategoryName.trim(), type: newCategoryType },
                  { onSuccess: () => setNewCategoryName("") }
                );
              }}
              disabled={!newCategoryName.trim() || addCategory.isPending}
            >
              {addCategory.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Income categories */}
          {ledgerType === "umum" && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-emerald-600">Pemasukan</h4>
              <div className="space-y-1">
                {categoriesData
                  ?.filter((c) => c.type === "income")
                  .map((cat) => <CategoryRow key={cat.id} cat={cat} />)}
              </div>
            </div>
          )}

          {/* Outcome categories */}
          {ledgerType === "umum" && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-red-600">Pengeluaran</h4>
              <div className="space-y-1">
                {categoriesData
                  ?.filter((c) => c.type === "outcome")
                  .map((cat) => <CategoryRow key={cat.id} cat={cat} />)}
              </div>
            </div>
          )}

          {/* Donation categories */}
          {ledgerType === "donasi" && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-blue-600">Kategori Donasi</h4>
              <div className="space-y-1">
                {categoriesData
                  ?.filter((c) => c.type === "donation" || c.type === "donation_outcome")
                  .map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <span className="text-sm capitalize">
                        {cat.name} -{" "}
                        {cat.type === "donation" ? "Uang Masuk" : "Pengeluaran"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteCategory.mutate(cat.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
