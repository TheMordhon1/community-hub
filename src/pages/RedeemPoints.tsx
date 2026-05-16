
import { useAuth } from "@/hooks/useAuth";
import { useRewardItems, useRedeemPoint } from "@/hooks/useGamification";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Gift, ShoppingBag, ArrowLeft, Info } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function RedeemPoints() {
  const { user, profile } = useAuth();
  const { data: rewards, isLoading } = useRewardItems();
  const redeemMutation = useRedeemPoint();

  const userPoints = (profile as { points?: number } | null)?.points || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="p-6 space-y-6 max-w-6xl mx-auto min-h-screen bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link to="/profile" className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight">Tukar Poin</h1>
            <p className="text-muted-foreground">Pilih hadiah menarik untuk hasil partisipasimu</p>
          </div>
        </div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-4 flex items-center gap-4 self-start"
        >
          <div className="p-3 bg-primary rounded-xl shadow-lg shadow-primary/20">
            <Trophy className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-wider">Poin Kamu</p>
            <p className="text-3xl font-black text-primary leading-none mt-1">{userPoints}</p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rewards?.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full flex flex-col overflow-hidden border-primary/5 hover:border-primary/20 transition-all group">
              <div className="aspect-video bg-muted relative overflow-hidden">
                {item.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary/20">
                    <Gift className="w-16 h-16" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary text-primary-foreground font-bold px-3 py-1 text-sm shadow-lg">
                    {item.points_cost} Poin
                  </Badge>
                </div>
              </div>

              <CardHeader>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{item.name}</CardTitle>
                <CardDescription className="line-clamp-2">{item.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Stok: {item.stock}</span>
                </div>
              </CardContent>

              <CardFooter className="pt-0 pb-6 px-6">
                <Button 
                  className="w-full font-bold h-11" 
                  disabled={userPoints < item.points_cost || item.stock <= 0 || redeemMutation.isPending}
                  onClick={() => redeemMutation.mutate({ user_id: user?.id!, item_id: item.id, points_cost: item.points_cost })}
                >
                  {redeemMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : userPoints < item.points_cost ? (
                    "Poin Tidak Cukup"
                  ) : item.stock <= 0 ? (
                    "Stok Habis"
                  ) : (
                    "Tukarkan Sekarang"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start mt-8">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">Cara Penukaran Hadiah:</p>
          <ol className="list-decimal list-inside space-y-1 opacity-90">
            <li>Pilih hadiah yang kamu inginkan dan klik tombol "Tukarkan Sekarang".</li>
            <li>Poin kamu akan otomatis terpotong sesuai harga hadiah.</li>
            <li>Admin/Pengurus akan memverifikasi permintaanmu.</li>
            <li>Hubungi Bendahara atau Pengurus untuk pengambilan hadiah fisik.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
