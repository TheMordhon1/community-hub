import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Home, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { House } from "@/types/database";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Nama lengkap minimal 2 karakter")
      .max(100, "Nama terlalu panjang"),
    houseId: z.string().min(1, "Pilih nomor rumah"),
    email: z
      .string()
      .email("Email tidak valid")
      .max(255, "Email terlalu panjang"),
    password: z
      .string()
      .min(6, "Password minimal 6 karakter")
      .max(100, "Password terlalu panjang"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data: houses, isLoading: housesLoading } = useQuery({
    queryKey: ["houses-register"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("*")
        .order("block")
        .order("number");

      if (error) throw error;
      return data as House[];
    },
  });

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      houseId: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);

    // Find the selected house
    const selectedHouse = houses?.find((h) => h.id === data.houseId);

    const { error, userId } = await signUp(data.email, data.password, data.fullName);
    setIsLoading(false);

    if (error) {
      let message = "Terjadi kesalahan saat mendaftar";
      if (error.message.includes("already registered")) {
        message = "Email sudah terdaftar";
      } else if (error.message.includes("invalid")) {
        message = "Data yang dimasukkan tidak valid";
      }
      toast({
        variant: "destructive",
        title: "Gagal Mendaftar",
        description: message,
      });
      return;
    }

    // Link user to house via house_residents
    if (userId && selectedHouse) {
      await supabase.from("house_residents").insert({
        user_id: userId,
        house_id: selectedHouse.id,
        is_owner: false,
      });

      // Mark house as occupied
      await supabase
        .from("houses")
        .update({ is_occupied: true })
        .eq("id", selectedHouse.id);
    }

    toast({
      title: "Berhasil Mendaftar!",
      description: "Selamat datang di Pesona Kenari Townhouse",
    });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card">
          <CardHeader className="text-center space-y-2">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2"
            >
              <Home className="w-8 h-8 text-primary" />
            </motion.div>
            <CardTitle className="font-display text-2xl">Daftar Akun</CardTitle>
            <CardDescription>Bergabung dengan warga PKT</CardDescription>
          </CardHeader>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap</Label>
                <Input
                  id="fullName"
                  placeholder="Masukkan nama lengkap"
                  {...form.register("fullName")}
                />
                {form.formState.errors.fullName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="houseId">Nomor Rumah</Label>
                <Select
                  value={form.watch("houseId")}
                  onValueChange={(value) => form.setValue("houseId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={housesLoading ? "Memuat..." : "Pilih nomor rumah"} />
                  </SelectTrigger>
                  <SelectContent>
                    {houses?.map((house) => (
                      <SelectItem key={house.id} value={house.id}>
                        Blok {house.block} No. {house.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.houseId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.houseId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimal 6 karakter"
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Ulangi password"
                    {...form.register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading || housesLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Daftar
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Sudah punya akun?{" "}
                <Link
                  to="/login"
                  className="text-primary hover:underline font-medium"
                >
                  Masuk di sini
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
