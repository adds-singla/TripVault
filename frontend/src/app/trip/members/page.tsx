"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTrip } from "@/components/TripContext";
import { ShareModal } from "@/components/modals";
import { Avatar, Button, Card, Chip, PageTitle } from "@/components/ui";

export default function Members() {
  const { trip, isOwner } = useTrip(); const { user } = useAuth(); const [open, setOpen] = useState(false);
  return (
    <>
      <PageTitle title="Trip members" sub="Owners manage access. Editors add content. Viewers read only." right={<Button onClick={() => setOpen(true)}><UserPlus size={16} />{isOwner ? "Invite & manage" : "View sharing"}</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trip.members.map((m) => (
          <Card key={m.id} className="flex items-center gap-4 p-5"><Avatar name={m.name} size={48} />
            <div className="min-w-0 flex-1"><div className="truncate text-label-lg">{m.name}{m.id === user?.id && " (you)"}</div><div className="truncate text-body-sm text-muted">{m.email}</div></div>
            <Chip tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Chip></Card>))}
      </div>
      <ShareModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
