import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, PENGURUS_TITLE_LABELS } from "@/types/database";
import { LogOut } from "lucide-react";

export default function Profile() {
  const { profile, role, pengurusTitle, signOut } = useAuth();

  const getRoleDisplay = () => {
    if (!role) return "User";
    if (role === "pengurus" && pengurusTitle)
      return PENGURUS_TITLE_LABELS[pengurusTitle];
    return ROLE_LABELS[role];
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Profil Saya</CardTitle>
              <CardDescription>Informasi akun dan data diri</CardDescription>
            </CardHeader>
            <CardContent className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <Avatar className="w-20 h-20">
                  {profile?.avatar_url ? (
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={profile.full_name}
                    />
                  ) : (
                    <AvatarFallback>
                      {profile?.full_name?.charAt(0) ?? "U"}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-medium">
                  {profile?.full_name ?? "-"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {getRoleDisplay()}
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p>{profile?.email ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nomor Rumah</p>
                    <p>{profile?.house_number ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telepon</p>
                    <p>{profile?.phone ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bergabung</p>
                    <p>
                      {profile?.created_at
                        ? new Date(profile.created_at).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={signOut}>
                    <LogOut className="w-4 h-4 mr-2" /> Keluar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
