import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../app/AuthContext";

import { formatSessionDisplayName } from "../../../shared/session/sessionLabels";

import { createSessionShare, createTeam, createTeamInvite, fetchMemberTeams, fetchMySessions, fetchOwnedTeams, fetchTeamDetails, fetchTeamMembers, removeTeamMember, revokeTeamInvite, updateTeam } from "../../../lib/serverApi";

import { getTorontoDate } from "../../../lib/torontoDate";

import { clearCurrentTeamId, setCurrentTeamId } from "../../../lib/teamStorage";

export type TeamEntry = {
    id: string;
    name: string;
    available_locations?: string[];
};

export type ProfileResult = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
};

export type InviteEntry = {
    id: string;
    invitee_id: string;
    status: string;
    profiles?: { first_name: string; last_name: string; email: string } | null;
};

export type MemberEntry = {
    user_id: string;
    role: string;
    profiles?: { first_name: string; last_name: string; email: string } | null;
};

export type SessionEntry = {
    id: string;
    team_id: string | null;
    session_day: string;
    session_season: string | null;
    session_year: number | null;
    start_date: string | null;
    end_date: string | null;
    session_start_time24: string | null;
    session_end_time24: string | null;
};

export function getSessionLabel(session: SessionEntry) {
    return formatSessionDisplayName({
        sessionDay: session.session_day,
        sessionSeason: session.session_season,
        sessionYear: session.session_year,
        startDate: session.start_date,
        sessionStartTime24: session.session_start_time24,
        sessionEndTime24: session.session_end_time24,
    });
}
export function useTeamLogic() {
    const { accountType, isGuest, user } = useAuth();
    const [teams, setTeams] = useState<TeamEntry[]>([]);
    const [activeTeamId, setActiveTeamId] = useState("");
    const [teamName, setTeamName] = useState("");
    const [locationsInput, setLocationsInput] = useState("");
    const [invites, setInvites] = useState<InviteEntry[]>([]);
    const [members, setMembers] = useState<MemberEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [memberTeams, setMemberTeams] = useState<TeamEntry[]>([]);
    const [userSessions, setUserSessions] = useState<SessionEntry[]>([]);
    const [shareSessionId, setShareSessionId] = useState("");
    const [shareDate, setShareDate] = useState(() => getTorontoDate());
    const [shareMemberId, setShareMemberId] = useState("");
    const [shareAllowEdits, setShareAllowEdits] = useState(false);
    const [shareMembers, setShareMembers] = useState<MemberEntry[]>([]);
    const [shareMessage, setShareMessage] = useState("");

    useEffect(() => {
        if (!user || accountType !== "full_time") {
            return;
        }
        const loadTeams = async () => {
            const response = await fetchOwnedTeams();
            const rows = (response.teams ?? []) as TeamEntry[];
            setTeams(rows);
            if (rows.length === 0) {
                setActiveTeamId("");
                clearCurrentTeamId();
                setLocationsInput("");
                return;
            }
            const hasActive = rows.some((team) => team.id === activeTeamId);
            if (!hasActive) {
                setActiveTeamId(rows[0].id);
                setCurrentTeamId(rows[0].id);
                setLocationsInput(
                    (rows[0].available_locations ?? []).join(", "),
                );
            }
        };
        void loadTeams();
    }, [accountType, activeTeamId, user]);

    useEffect(() => {
        if (!user || accountType === "full_time") {
            return;
        }
        const loadMemberTeams = async () => {
            const response = await fetchMemberTeams();
            const rows = (response.teams ?? []) as {
                team_id: string;
                teams: TeamEntry | null;
            }[];
            const nextTeams = rows.map((row) => row.teams).filter(
                Boolean,
            ) as TeamEntry[];
            setMemberTeams(nextTeams);
        };
        const loadSessions = async () => {
            const response = await fetchMySessions();
            setUserSessions((response.sessions ?? []) as SessionEntry[]);
        };
        void loadMemberTeams();
        void loadSessions();
    }, [accountType, user]);

    useEffect(() => {
        if (!activeTeamId || !user || accountType !== "full_time") {
            return;
        }
        const loadTeamDetails = async () => {
            const response = await fetchTeamDetails(activeTeamId);
            setInvites((response.invites ?? []) as InviteEntry[]);
            setMembers((response.members ?? []) as MemberEntry[]);
        };
        void loadTeamDetails();
    }, [accountType, activeTeamId, user]);

    useEffect(() => {
        if (accountType !== "full_time") {
            return;
        }
        const activeTeam = teams.find((team) => team.id === activeTeamId);
        setLocationsInput((activeTeam?.available_locations ?? []).join(", "));
    }, [accountType, activeTeamId, teams]);

    const memberIds = useMemo(
        () => new Set(members.map((member) => member.user_id)),
        [members],
    );
    const invitedIds = useMemo(
        () => new Set(invites.map((invite) => invite.invitee_id)),
        [invites],
    );
    const shareableSessions = useMemo(
        () => userSessions.filter((session) => Boolean(session.team_id)),
        [userSessions],
    );

    useEffect(() => {
        if (!user || accountType === "full_time" || !shareSessionId) {
            setShareMembers([]);
            return;
        }
        const session = shareableSessions.find((item) =>
            item.id === shareSessionId
        );
        if (!session || !session.team_id) {
            setShareMembers([]);
            return;
        }
        const teamId = session.team_id;
        const loadMembers = async () => {
            const response = await fetchTeamMembers(teamId);
            const rows = (response.members ?? []) as MemberEntry[];
            setShareMembers(
                rows.filter((member) => member.user_id !== user.id),
            );
        };
        void loadMembers();
    }, [accountType, shareSessionId, shareableSessions, user]);

    const handleCreateTeam = async () => {
        if (!user || !teamName.trim()) {
            return;
        }
        const locations = locationsInput
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        setLoading(true);
        setMessage("");
        try {
            const response = await createTeam({
                name: teamName.trim(),
                available_locations: locations,
            });
            const data = response.team as TeamEntry | undefined;
            if (data) {
                setTeams((current) => [...current, data]);
                setActiveTeamId(data.id);
                setCurrentTeamId(data.id);
                setTeamName("");
                setLocationsInput((data.available_locations ?? []).join(", "));
                setMessage("Team created.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (profile: ProfileResult) => {
        if (!activeTeamId) {
            return;
        }
        setLoading(true);
        setMessage("");
        try {
            const response = await createTeamInvite(activeTeamId, profile.id);
            const data = response.invite;
            if (data) {
                setInvites((current) => [...current, data]);
            }
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to invite user",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeInvite = async (invite: InviteEntry) => {
        setLoading(true);
        setMessage("");
        try {
            await revokeTeamInvite(invite.id);
            setInvites((current) =>
                current.filter((item) => item.id !== invite.id)
            );
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to revoke invite",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateLocations = async () => {
        if (!activeTeamId) {
            return;
        }
        const locations = locationsInput
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        setLoading(true);
        setMessage("");
        try {
            await updateTeam(activeTeamId, { available_locations: locations });
            setTeams((current) =>
                current.map((team) =>
                    team.id === activeTeamId
                        ? { ...team, available_locations: locations }
                        : team
                )
            );
            setMessage("Locations updated.");
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to update locations",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleShareSession = async () => {
        if (!user || !shareSessionId || !shareMemberId || !shareDate) {
            setShareMessage("Select a session, teammate, and date.");
            return;
        }
        setLoading(true);
        setShareMessage("");
        try {
            await createSessionShare({
                session_id: shareSessionId,
                share_date: shareDate,
                shared_with: shareMemberId,
                allow_roster_edits: shareAllowEdits,
            });
            setShareMessage("Session shared.");
            setShareMemberId("");
        } catch (error) {
            setShareMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to share session",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (member: MemberEntry) => {
        if (!activeTeamId) {
            return;
        }
        setLoading(true);
        try {
            await removeTeamMember(activeTeamId, member.user_id);
            setMembers((current) =>
                current.filter((item) => item.user_id !== member.user_id)
            );
        } finally {
            setLoading(false);
        }
    };

    if (isGuest) {
        return { view: "hidden" as const };
    }

    if (accountType !== "full_time") {
        return {
            view: "ready" as const,
            memberTeams,
            shareSessionId,
            setShareSessionId,
            shareableSessions,
            shareMemberId,
            setShareMemberId,
            shareMembers,
            shareDate,
            setShareDate,
            shareAllowEdits,
            setShareAllowEdits,
            handleShareSession,
            loading,
            shareMessage,
        };
    }

    return {
        view: "view2" as const,
        teamName,
        setTeamName,
        locationsInput,
        setLocationsInput,
        handleCreateTeam,
        loading,
        message,
        teams,
        activeTeamId,
        setActiveTeamId,
        handleUpdateLocations,
        memberIds,
        invitedIds,
        handleInvite,
        invites,
        handleRevokeInvite,
        members,
        user,
        handleRemoveMember,
    };

}
