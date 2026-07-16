import type {
  IssueDocument,
  IssueThreadInteraction,
  IssueWorkProduct,
} from "@paperclipai/shared";
import type {
  VitalsAiSdrDogfoodBundle,
  VitalsAiSdrDownstreamBlock,
  VitalsAiSdrIntakeInput,
} from "@paperclipai/shared/vitals-ai-sdr";
import { api } from "./client";

export type VitalsAiSdrFixtureSummary = {
  id: string;
  companyName: string;
  website: string;
  prospectRole: string;
  geography: string;
  segment: string;
  citationCount: number;
};

export type VitalsAiSdrLocalFixturesResponse = {
  leadSourceKind: "local_fixture";
  fixtures: VitalsAiSdrFixtureSummary[];
  downstreamBlocks: VitalsAiSdrDownstreamBlock[];
};

export type VitalsAiSdrLocalDogfoodResponse = {
  bundle: VitalsAiSdrDogfoodBundle;
  documents: {
    intake: IssueDocument;
    dossiers: IssueDocument;
    drafts: IssueDocument;
    measurements: IssueDocument;
  };
  workProducts: IssueWorkProduct[];
  interaction: IssueThreadInteraction;
};

export const vitalsAiSdrApi = {
  localFixtures: (companyId: string) =>
    api.get<VitalsAiSdrLocalFixturesResponse>(`/companies/${companyId}/vitals/ai-sdr/local-fixtures`),
  runLocalDogfood: (
    companyId: string,
    input: { issueId: string; intake: VitalsAiSdrIntakeInput },
  ) =>
    api.post<VitalsAiSdrLocalDogfoodResponse>(
      `/companies/${companyId}/vitals/ai-sdr/local-dogfood`,
      input,
    ),
};
