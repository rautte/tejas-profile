// src/components/admin/ConfigurationAnalyticsArchivePanelPointsUi.test.js
//
// Covers the archive-table UI work added for the historical-archive
// enhancement points: Target Location / Target Job Role / Outreach
// Score columns joined via the batch endpoints, the favorite
// star/toolbar, the UI-only hide/restore visibility flag, and the
// Outreach Score section in the Selected Usage Epoch detail panel.

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import ConfigurationAnalyticsArchivePanel from "./ConfigurationAnalyticsArchivePanel";

import {
  getConfigurationAnalyticsReport,
  getConfigurationAnalyticsReportsBatch,
  listUsageEpochs,
} from "../../utils/analytics/analyticsApi";

import {
  getProfileVariantsBatch,
} from "../../utils/snapshots/snapshotsApi";


jest.mock(
  "../../utils/analytics/analyticsApi",
  () => ({
    getConfigurationAnalyticsReport:
      jest.fn(),

    getConfigurationAnalyticsReportsBatch:
      jest.fn(),

    listUsageEpochs:
      jest.fn(),
  })
);


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    getProfileVariantsBatch:
      jest.fn(),
  })
);


const CLOSED_EPOCH = {
  usageEpochId: "uep_points_ui",
  stage: "prod",
  deploymentConfigurationId: "cfg_points_ui",
  platformReleaseId: "plr_points_ui",
  profileVariantId: "prv_points_ui",
  state: "CLOSED",
  startedAt: "2026-08-20T00:00:00.000Z",
  endedAt: "2026-08-21T00:00:00.000Z",
  report: {
    reportId: "car_points_ui",
    reportSha256: "sha_points_ui",
    finalizedAt: "2026-08-22T00:00:00.000Z",
  },
};


const OUTREACH_SCORE = {
  algorithm: "outreach-score.v1",
  score: 63,
  confidence: "medium",
  components: {
    reach: 50,
    engagement: 60,
    depth: 40,
    intent: 70,
    consistency: 65,
  },
};


function trafficSlice(overrides = {}) {
  return {
    overview: {
      uniqueVisitors: 0,
      sessions: 0,
      eventCount: 0,
      activeMs: 0,
    },
    sections: [],
    ctas: [],
    projects: [],
    snippets: [],
    deepLinks: [],
    depthMilestones: [],
    countries: [],
    cities: [],
    daily: [],
    ...overrides,
  };
}


const REPORT_RESPONSE = {
  ok: true,
  usageEpoch: CLOSED_EPOCH,
  reportSha256: "sha_points_ui",
  report: {
    schemaId: "tejas-profile.configuration-analytics-report.v2",
    reportId: "car_points_ui",
    usageEpochId: "uep_points_ui",
    stage: "prod",
    deploymentConfigurationId: "cfg_points_ui",
    platformReleaseId: "plr_points_ui",
    profileVariantId: "prv_points_ui",
    interval: {
      startedAt: CLOSED_EPOCH.startedAt,
      endedAt: CLOSED_EPOCH.endedAt,
    },
    traffic: {
      classifierVersion: "traffic-classifier.v1",
      summary: {
        all: { uniqueVisitors: 0, sessions: 0, eventCount: 0, activeMs: 0 },
        likely_human: { uniqueVisitors: 0, sessions: 0, eventCount: 0, activeMs: 0 },
        likely_automated: { uniqueVisitors: 0, sessions: 0, eventCount: 0, activeMs: 0 },
        uncertain: { uniqueVisitors: 0, sessions: 0, eventCount: 0, activeMs: 0 },
      },
    },
    analyticsByTraffic: {
      all: trafficSlice(),
      likely_human: trafficSlice({
        outreachScore: OUTREACH_SCORE,
        engagement: {
          meaningfulSessionCount: 3,
          engagedSessionCount: 1,
          topSessionActiveMsShare: 0.42,
        },
      }),
      likely_automated: trafficSlice(),
      uncertain: trafficSlice(),
    },
  },
};


beforeEach(() => {
  jest.clearAllMocks();

  listUsageEpochs.mockResolvedValue({
    ok: true,
    epochs: [CLOSED_EPOCH],
    nextToken: null,
  });

  getConfigurationAnalyticsReport.mockResolvedValue(REPORT_RESPONSE);

  getConfigurationAnalyticsReportsBatch.mockResolvedValue([
    { usageEpochId: CLOSED_EPOCH.usageEpochId, outreachScore: OUTREACH_SCORE },
  ]);

  getProfileVariantsBatch.mockResolvedValue([
    {
      profileVariantId: CLOSED_EPOCH.profileVariantId,
      targeting: { location: "Remote — US", jobRole: "Staff Engineer" },
    },
  ]);

  window.localStorage.clear();
});


describe("ConfigurationAnalyticsArchivePanel — Target Location / Job Role / Outreach Score columns", () => {
  test("joins targeting and Outreach Score onto each row via the batch endpoints", async () => {
    render(<ConfigurationAnalyticsArchivePanel />);

    await waitFor(() => {
      expect(getProfileVariantsBatch).toHaveBeenCalledWith([
        "prv_points_ui",
      ]);
    });

    await waitFor(() => {
      expect(getConfigurationAnalyticsReportsBatch).toHaveBeenCalledWith({
        usageEpochIds: ["uep_points_ui"],
      });
    });

    expect(await screen.findByText("Remote — US")).toBeInTheDocument();
    expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
    expect(screen.getByText("63")).toBeInTheDocument();
  });
});


describe("ConfigurationAnalyticsArchivePanel — favorites", () => {
  test("marking a selected row as favorite shows a star and persists to localStorage", async () => {
    render(<ConfigurationAnalyticsArchivePanel />);

    const rowCheckbox = await screen.findByLabelText(
      "Select Usage Epoch uep_points_ui"
    );

    fireEvent.click(rowCheckbox);

    const addFavoriteButton = await screen.findByText("Add Favorite");
    fireEvent.click(addFavoriteButton);

    expect(await screen.findByTitle("Favorite")).toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(
        "admin_analytics_archive_favorites_v1"
      )
    );

    expect(stored).toEqual({ uep_points_ui: true });
  });
});


describe("ConfigurationAnalyticsArchivePanel — UI-only hide/restore", () => {
  test("hiding a selected row removes it from view, and Show hidden reveals it again", async () => {
    render(<ConfigurationAnalyticsArchivePanel />);

    const rowCheckbox = await screen.findByLabelText(
      "Select Usage Epoch uep_points_ui"
    );

    fireEvent.click(rowCheckbox);

    const hideButton = await screen.findByText("Hide");
    fireEvent.click(hideButton);

    await waitFor(() => {
      expect(
        screen.queryByText("uep_points_ui")
      ).not.toBeInTheDocument();
    });

    const stored = JSON.parse(
      window.localStorage.getItem(
        "admin_analytics_archive_hidden_v1"
      )
    );
    expect(stored).toEqual({ uep_points_ui: true });

    const showHiddenToggle = screen.getByLabelText(/Show hidden/i, {
      selector: "input",
    }) || screen.getByRole("checkbox", { name: /Show hidden/i });

    fireEvent.click(showHiddenToggle);

    expect(await screen.findByText("uep_points_ui")).toBeInTheDocument();
    expect(screen.getByTitle("Hidden")).toBeInTheDocument();
  });
});


describe("ConfigurationAnalyticsArchivePanel — Outreach Score detail panel", () => {
  test("shows the Outreach Score, confidence and component breakdown for a selected Usage Epoch", async () => {
    render(<ConfigurationAnalyticsArchivePanel />);

    const row = await screen.findByText("uep_points_ui");
    fireEvent.click(row);

    expect(await screen.findByText("Outreach Score")).toBeInTheDocument();
    expect(screen.getByText("medium confidence")).toBeInTheDocument();

    const scoreValues = screen.getAllByText("63");
    expect(scoreValues.length).toBeGreaterThan(0);

    expect(screen.getByText("reach")).toBeInTheDocument();
    expect(screen.getByText("engagement")).toBeInTheDocument();
  });
});
