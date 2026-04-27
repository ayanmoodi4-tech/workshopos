import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RecipientRole } from "../backend";
import type { NotificationRecord } from "../backend.d.ts";
import { useBackendActor } from "../lib/api";
import { useAuth } from "./use-auth";

function roleToRecipientRole(role: string | null): RecipientRole | null {
  switch (role) {
    case "Admin":
      return RecipientRole.admin;
    case "SalesManager":
      return RecipientRole.salesManager;
    case "WorkshopManager":
      return RecipientRole.workshopManager;
    default:
      return null;
  }
}

export function useNotifications() {
  const { actor, isFetching } = useBackendActor();
  const { role, isAuthenticated } = useAuth();
  const recipientRole = roleToRecipientRole(role);

  const { data: notifications = [], isLoading } = useQuery<
    NotificationRecord[]
  >({
    queryKey: ["notifications", recipientRole],
    queryFn: async () => {
      if (!actor || !recipientRole) return [];
      return actor.getMyNotifications(recipientRole);
    },
    enabled: !!actor && !isFetching && isAuthenticated && !!recipientRole,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const { data: unreadCount = 0n } = useQuery<bigint>({
    queryKey: ["notificationsUnreadCount", recipientRole],
    queryFn: async () => {
      if (!actor || !recipientRole) return 0n;
      return actor.getUnreadCount(recipientRole);
    },
    enabled: !!actor && !isFetching && isAuthenticated && !!recipientRole,
    refetchInterval: 10_000,
  });

  return {
    notifications,
    unreadCount: Number(unreadCount),
    isLoading,
    recipientRole,
  };
}

export function useMarkNotificationRead() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();

  return async (id: bigint) => {
    if (!actor) return;
    await actor.markNotificationRead(id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notificationsUnreadCount"] });
  };
}

export function useMarkAllRead() {
  const { actor } = useBackendActor();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  return async () => {
    if (!actor || !role) return;
    const recipientRole = roleToRecipientRole(role);
    if (!recipientRole) return;
    await actor.markAllNotificationsRead(recipientRole);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notificationsUnreadCount"] });
  };
}
