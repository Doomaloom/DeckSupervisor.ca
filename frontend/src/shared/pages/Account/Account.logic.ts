import { useEffect, useState } from "react";

import { useAuth } from "../../../app/AuthContext";

import { acceptTeamInvite, declineTeamInvite, fetchAccountData, } from "../../../lib/serverApi";

export type InviteEntry = {
    id: string;
    team_id: string;
    status: string;
    teams?: { name: string } | null;
};

export type MembershipEntry = {
    team_id: string;
    role: string;
    teams?: { name: string } | null;
};
export function useAccountLogic() {
    const { completeProfile, isGuest, profile, user } = useAuth();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [location, setLocation] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");
    const [inviteError, setInviteError] = useState("");
    const [invites, setInvites] = useState<InviteEntry[]>([]);
    const [memberships, setMemberships] = useState<MembershipEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setFirstName(profile?.first_name ?? "");
        setLastName(profile?.last_name ?? "");
        setLocation(profile?.location ?? "");
    }, [profile]);

    useEffect(() => {
        if (!user) {
            return;
        }
        const loadData = async () => {
            const data = await fetchAccountData();
            setInvites(data.invites ?? []);
            setMemberships(data.memberships ?? []);
        };
        void loadData();
    }, [user]);

    const handleSaveProfile = async () => {
        const trimmedFirst = firstName.trim();
        const trimmedLast = lastName.trim();
        if (!trimmedFirst || !trimmedLast) {
            setSaveError("Please enter your first and last name.");
            return;
        }
        setSaveError("");
        setSaveMessage("");
        setLoading(true);
        try {
            await completeProfile(
                trimmedFirst,
                trimmedLast,
                location.trim() || undefined,
            );
            setSaveMessage("Profile updated.");
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptInvite = async (invite: InviteEntry) => {
        if (!user) {
            return;
        }
        setLoading(true);
        setInviteError("");
        try {
            await acceptTeamInvite(invite.id);
            const data = await fetchAccountData();
            setInvites(data.invites ?? []);
            setMemberships(data.memberships ?? []);
        } catch (error) {
            setInviteError(
                error instanceof Error
                    ? error.message
                    : "Failed to accept invite",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDeclineInvite = async (invite: InviteEntry) => {
        setInviteError("");
        setLoading(true);
        try {
            await declineTeamInvite(invite.id);
            setInvites((current) =>
                current.filter((item) => item.id !== invite.id)
            );
        } catch (error) {
            setInviteError(
                error instanceof Error
                    ? error.message
                    : "Failed to decline invite",
            );
        } finally {
            setLoading(false);
        }
    };

    if (isGuest) {
        return { view: "guest" as const };
    }

    return {
        view: "ready" as const,
        firstName,
        setFirstName,
        lastName,
        setLastName,
        location,
        setLocation,
        handleSaveProfile,
        loading,
        saveMessage,
        saveError,
        inviteError,
        invites,
        handleAcceptInvite,
        handleDeclineInvite,
        memberships,
    };

}
