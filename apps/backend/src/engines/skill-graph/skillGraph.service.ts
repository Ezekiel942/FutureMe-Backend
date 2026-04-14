import { AppDataSource } from '@config/database';
import { SkillGraph } from '../../database/models/SkillGraph.model';

/**
 * SkillGraph Service
 *
 * Manages user skill tracking and proficiency levels for workforce intelligence.
 * Provides functions for skill management and task assignment optimization.
 */

interface SkillScore {
  skill: string;
  proficiency: number;
  projectCount: number;
  experienceFactor: number;
  skillScore: number;
}

export const addSkill = async (
  userId: string,
  organizationId: string,
  skill: string,
  initialProficiency: number = 1
) => {
  // Check if skill already exists for user
  const existingSkill = await SkillGraph.findOne({
    where: { userId, skill },
  });

  if (existingSkill) {
    throw new Error(`Skill '${skill}' already exists for this user`);
  }

  const skillEntry = new SkillGraph();
  skillEntry.userId = userId;
  skillEntry.organizationId = organizationId;
  skillEntry.skill = skill;
  skillEntry.proficiency = Math.max(1, Math.min(5, initialProficiency)); // Clamp to 1-5

  return await skillEntry.save();
};

export const updateProficiency = async (userId: string, skill: string, level: number) => {
  const skillEntry = await SkillGraph.findOne({
    where: { userId, skill },
  });

  if (!skillEntry) {
    throw new Error(`Skill '${skill}' not found for this user`);
  }

  skillEntry.proficiency = Math.max(1, Math.min(5, level)); // Clamp to 1-5
  skillEntry.lastUpdated = new Date();

  return await skillEntry.save();
};

export const incrementProjectCount = async (userId: string, skill: string) => {
  const skillEntry = await SkillGraph.findOne({
    where: { userId, skill },
  });

  if (!skillEntry) {
    throw new Error(`Skill '${skill}' not found for this user`);
  }

  skillEntry.projectCount += 1;
  skillEntry.lastUpdated = new Date();

  return await skillEntry.save();
};

export const getUserSkills = async (userId: string) => {
  return await SkillGraph.find({
    where: { userId },
    order: { proficiency: 'DESC', lastUpdated: 'DESC' },
  });
};

export const getTopUsersForSkill = async (
  organizationId: string,
  skill: string,
  limit: number = 10
) => {
  return await SkillGraph.find({
    where: { organizationId, skill },
    order: { proficiency: 'DESC', projectCount: 'DESC' },
    take: limit,
  });
};

export const getSkillDistribution = async (organizationId: string) => {
  const skills = await AppDataSource.getRepository(SkillGraph).find({ where: { organizationId } });

  const grouped = skills.reduce(
    (acc: Record<string, { count: number; total: number }>, row: any) => {
      const skill = row.skill || 'unknown';
      if (!acc[skill]) acc[skill] = { count: 0, total: 0 };
      acc[skill].count += 1;
      acc[skill].total += Number(row.proficiency || 0);
      return acc;
    },
    {}
  );

  return Object.entries(grouped)
    .sort((a: any, b: any) => b[1].count - a[1].count)
    .map(([skill, data]: [string, any]) => ({
      skill,
      userCount: data.count,
      averageProficiency: (data.total / Math.max(1, data.count)).toFixed(2),
    }));
};

export const getUserSkillScore = async (
  userId: string,
  skill: string
): Promise<SkillScore | null> => {
  const skillEntry = await SkillGraph.findOne({
    where: { userId, skill },
  });

  if (!skillEntry) {
    return null;
  }

  // Calculate skill score: proficiency (1-5) * experience factor (based on project count)
  const experienceFactor = Math.min(2, 1 + skillEntry.projectCount * 0.1); // Max 2x multiplier
  const skillScore = skillEntry.proficiency * experienceFactor;

  return {
    skill: skillEntry.skill,
    proficiency: skillEntry.proficiency,
    projectCount: skillEntry.projectCount,
    experienceFactor,
    skillScore: Number(skillScore.toFixed(2)),
  };
};

export const suggestUsersForTask = async (
  organizationId: string,
  requiredSkills: string[],
  limit: number = 5
) => {
  if (requiredSkills.length === 0) {
    return [];
  }

  // Get all users with any of the required skills
  const skillEntries = await SkillGraph.find({
    where: { organizationId, skill: requiredSkills as any },
    order: { proficiency: 'DESC', projectCount: 'DESC' },
  });

  // Group by user and calculate composite score
  const userScores = new Map<
    string,
    {
      userId: string;
      skills: SkillScore[];
      totalScore: number;
      matchedSkills: number;
    }
  >();

  for (const entry of skillEntries) {
    const existing = userScores.get(entry.userId) || {
      userId: entry.userId,
      skills: [],
      totalScore: 0,
      matchedSkills: 0,
    };

    const skillScore = await getUserSkillScore(entry.userId, entry.skill);
    if (skillScore) {
      existing.skills.push(skillScore);
      existing.totalScore += skillScore.skillScore;
      existing.matchedSkills += 1;
    }

    userScores.set(entry.userId, existing);
  }

  // Sort by total score and return top users
  const sortedUsers = Array.from(userScores.values())
    .sort((a: any, b: any) => b.totalScore - a.totalScore)
    .slice(0, limit);

  return sortedUsers;
};

export default {
  addSkill,
  updateProficiency,
  incrementProjectCount,
  getUserSkills,
  getTopUsersForSkill,
  getSkillDistribution,
  getUserSkillScore,
  suggestUsersForTask,
};
