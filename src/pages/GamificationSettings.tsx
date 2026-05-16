
import { useState } from "react";
import { 
  useGamificationRules, 
  useUpdateGamificationRule, 
  GamificationRule,
  useRewardItems,
  useUpdateRewardItem,
  useCreateRewardItem,
  RewardItem,
  useGamificationEnabled,
  useUpdateGamificationEnabled,
  useAllRedemptions,
  useUpdateRedemptionStatus
} from "@/hooks/useGamification";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Trophy, Plus, Gift, Edit2, Settings2, Check, X, Clock as ClockIcon, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function GamificationSettings() {
  const { role } = useAuth();
  const { data: rules, isLoading: rulesLoading } = useGamificationRules();
  const { data: rewards, isLoading: rewardsLoading } = useRewardItems();
  const { data: redemptions, isLoading: redemptionsLoading } = useAllRedemptions();
  const { data: isEnabled, isLoading: enabledLoading } = useGamificationEnabled();
  
  const updateRuleMutation = useUpdateGamificationRule();
  const updateRewardMutation = useUpdateRewardItem();
  const createRewardMutation = useCreateRewardItem();
  const updateEnabledMutation = useUpdateGamificationEnabled();
  const updateRedemptionStatusMutation = useUpdateRedemptionStatus();

  const [editingRule, setEditingRule] = useState<GamificationRule | null>(null);
  const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Partial<RewardItem> | null>(null);

  if (role !== "admin" && role !== "pengurus") {
    return <Navigate to="/dashboard" replace />;
  }

  if (rulesLoading || rewardsLoading || enabledLoading || redemptionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }


  const handleSaveRule = (rule: GamificationRule) => {
    updateRuleMutation.mutate(rule);
    setEditingRule(null);
  };

  const handleSaveReward = () => {
    if (!editingReward?.name || !editingReward?.points_cost) return;

    if (editingReward.id) {
      updateRewardMutation.mutate(editingReward as RewardItem & { id: string }, {
        onSuccess: () => {
          setIsRewardDialogOpen(false);
          setEditingReward(null);
        }
      });
    } else {
      createRewardMutation.mutate({
        name: editingReward.name!,
        points_cost: editingReward.points_cost!,
        description: editingReward.description || "",
        stock: editingReward.stock || 0,
        image_url: editingReward.image_url || "",
        is_active: true,
        reward_type: editingReward.reward_type || 'physical_item',
        usage_limit: editingReward.usage_limit || 1
      }, {
        onSuccess: () => {
          setIsRewardDialogOpen(false);
          setEditingReward(null);
        }
      });
    }
  };

  return (
    <section className="p-6">
      <div className="flex flex-col space-y-6 md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Pengaturan Gamifikasi</h1>
            <p className="text-muted-foreground text-sm">Kelola aturan poin dan hadiah penukaran</p>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-1.5 bg-white rounded-md shadow-sm">
              <Settings2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold whitespace-nowrap">Fitur Poin:</Label>
              <Switch 
                checked={isEnabled} 
                onCheckedChange={(checked) => updateEnabledMutation.mutate(checked)}
              />
              <span className={`text-xs font-bold uppercase tracking-wider ${isEnabled ? "text-success" : "text-destructive"}`}>
                {isEnabled ? "Aktif" : "Non-Aktif"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={!isEnabled ? "opacity-50 pointer-events-none grayscale" : ""}>
        <Tabs defaultValue="rules" className="w-full">
        <TabsList className="grid w-full md:w-[600px] grid-cols-3">
          <TabsTrigger value="rules">Aturan Poin</TabsTrigger>
          <TabsTrigger value="rewards">Daftar Hadiah</TabsTrigger>
          <TabsTrigger value="redemptions">Penukaran Poin</TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-6 mt-6">
          <div className="grid gap-6">
            {rules?.map((rule) => (
              <Card key={rule.id} className="overflow-hidden border-primary/10 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{rule.action_name}</CardTitle>
                      <CardDescription className="text-xs">{rule.action_key}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">{rule.points}</span>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Poin</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Jumlah Poin</Label>
                        <Input
                          type="number"
                          value={editingRule?.id === rule.id ? editingRule.points : rule.points}
                          onChange={(e) => setEditingRule({ ...(editingRule || rule), id: rule.id, points: parseInt(e.target.value) || 0 })}
                          disabled={editingRule?.id !== rule.id}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Keterangan</Label>
                        <Input
                          value={editingRule?.id === rule.id ? (editingRule.description || "") : (rule.description || "")}
                          onChange={(e) => setEditingRule({ ...(editingRule || rule), id: rule.id, description: e.target.value })}
                          disabled={editingRule?.id !== rule.id}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingRule?.id === rule.id ? editingRule.is_active : rule.is_active}
                          onCheckedChange={(checked) => {
                             const updated = { ...(editingRule || rule), id: rule.id, is_active: checked };
                             if (editingRule?.id === rule.id) {
                               setEditingRule(updated);
                             } else {
                               updateRuleMutation.mutate(updated);
                             }
                          }}
                        />
                        <Label>Aktif</Label>
                      </div>

                      <div className="flex items-center gap-2">
                        {editingRule?.id === rule.id ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setEditingRule(null)}>Batal</Button>
                            <Button size="sm" onClick={() => handleSaveRule(editingRule)}>
                              <Save className="w-4 h-4 mr-2" /> Simpan
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setEditingRule(rule)}>Ubah</Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Dialog open={isRewardDialogOpen} onOpenChange={setIsRewardDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingReward({})}>
                  <Plus className="w-4 h-4 mr-2" /> Tambah Hadiah
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingReward?.id ? "Edit Hadiah" : "Tambah Hadiah Baru"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Nama Hadiah</Label>
                    <Input 
                      value={editingReward?.name || ""} 
                      onChange={(e) => setEditingReward({...editingReward, name: e.target.value})}
                      placeholder="Contoh: Voucher IPL"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Biaya Poin</Label>
                      <Input 
                        type="number" 
                        value={editingReward?.points_cost || ""} 
                        onChange={(e) => setEditingReward({...editingReward, points_cost: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipe Hadiah</Label>
                      <Select 
                        value={editingReward?.reward_type || "physical_item"}
                        onValueChange={(value) => setEditingReward({...editingReward, reward_type: value as RewardItem['reward_type']})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih tipe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="physical_item">Barang Fisik</SelectItem>
                          <SelectItem value="voucher">Voucher UMKM</SelectItem>
                          <SelectItem value="ipl_discount">Diskon Iuran (IPL)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Stok</Label>
                      <Input 
                        type="number" 
                        value={editingReward?.stock || ""} 
                        onChange={(e) => setEditingReward({...editingReward, stock: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Batas Penggunaan (Kali)</Label>
                      <Input 
                        type="number" 
                        placeholder="1"
                        value={editingReward?.usage_limit || ""} 
                        onChange={(e) => setEditingReward({...editingReward, usage_limit: parseInt(e.target.value) || 1})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>URL Gambar (Opsional)</Label>
                    <Input 
                      value={editingReward?.image_url || ""} 
                      onChange={(e) => setEditingReward({...editingReward, image_url: e.target.value})}
                      placeholder="https://example.com/image.png"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deskripsi</Label>
                    <Input 
                      value={editingReward?.description || ""} 
                      onChange={(e) => setEditingReward({...editingReward, description: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch 
                      checked={editingReward?.is_active !== false}
                      onCheckedChange={(checked) => setEditingReward({...editingReward, is_active: checked})}
                    />
                    <Label>Status Aktif</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsRewardDialogOpen(false)}>Batal</Button>
                  <Button onClick={handleSaveReward} disabled={createRewardMutation.isPending || updateRewardMutation.isPending}>
                    {createRewardMutation.isPending || updateRewardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Simpan
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards?.map((reward) => (
              <Card key={reward.id} className="overflow-hidden border-primary/10 hover:shadow-md transition-all">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Gift className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant={reward.is_active ? "default" : "secondary"}>
                      {reward.is_active ? "Aktif" : "Non-aktif"}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-3">{reward.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Biaya Poin</span>
                    <span className="font-bold text-primary">{reward.points_cost} Poin</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stok Tersisa</span>
                    <span className="font-medium">{reward.stock} unit</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={reward.is_active}
                        onCheckedChange={(checked) => updateRewardMutation.mutate({ id: reward.id, is_active: checked })}
                      />
                      <span className="text-xs text-muted-foreground">Aktif</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingReward(reward); setIsRewardDialogOpen(true); }}>
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        {/* Redemptions Tab */}
        <TabsContent value="redemptions" className="space-y-6 mt-6">
          <div className="grid gap-4">
            {redemptions?.length === 0 ? (
              <Card className="border-dashed border-2 py-12">
                <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
                  <ClockIcon className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium">Belum ada permintaan penukaran</p>
                </CardContent>
              </Card>
            ) : (
              redemptions?.map((redemption) => (
                <Card key={redemption.id} className="overflow-hidden border-primary/10 hover:shadow-md transition-all">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-primary/5 rounded-2xl shrink-0">
                          <Gift className="w-6 h-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-lg text-slate-800 leading-tight">
                            {redemption.reward_item?.name || "Hadiah tidak dikenal"}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                            <span className="font-medium text-slate-600">
                              {redemption.user_profile?.full_name || "User anonim"}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 bg-muted rounded font-bold">
                              {redemption.points_spent} Poin
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                            {format(new Date(redemption.created_at), "d MMMM yyyy, HH:mm", { locale: id })}
                          </p>
                          {redemption.status === 'approved' && redemption.redeem_code && (
                            <div className="mt-2 p-2 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between gap-4">
                              <div>
                                <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest leading-none mb-1">Kode Redeem</p>
                                <p className="font-mono font-black text-emerald-700 text-lg tracking-widest">{redemption.redeem_code}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest leading-none mb-1">Penggunaan</p>
                                <p className="text-xs font-bold text-emerald-800">
                                  {redemption.usage_count} / {redemption.usage_limit} Kali
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0 border-t md:border-none">
                        <div className="flex items-center gap-2">
                          {redemption.status === 'pending' ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
                              <ClockIcon className="w-3 h-3 mr-1" /> Menunggu
                            </Badge>
                          ) : redemption.status === 'approved' ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              <Check className="w-3 h-3 mr-1" /> Disetujui
                            </Badge>
                          ) : redemption.status === 'rejected' ? (
                            <Badge variant="secondary" className="bg-rose-100 text-rose-700 border-rose-200">
                              <X className="w-3 h-3 mr-1" /> Ditolak
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
                              {redemption.status}
                            </Badge>
                          )}
                        </div>

                        {redemption.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold"
                              onClick={() => updateRedemptionStatusMutation.mutate({ id: redemption.id, status: 'rejected' })}
                              disabled={updateRedemptionStatusMutation.isPending}
                            >
                              <X className="w-4 h-4 mr-1.5" /> Tolak
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-100"
                              onClick={() => updateRedemptionStatusMutation.mutate({ id: redemption.id, status: 'approved' })}
                              disabled={updateRedemptionStatusMutation.isPending}
                            >
                              <Check className="w-4 h-4 mr-1.5" /> Setujui
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>

    </section>
  );
}
