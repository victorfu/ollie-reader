import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ user: { uid: "uid-a" } as { uid: string } | null }));
const audioMocks = vi.hoisted(() => ({
  playMusic: vi.fn(),
  playSfx: vi.fn(),
  stopMusic: vi.fn(),
}));
const campaignMocks = vi.hoisted(() => ({
  recordResult: vi.fn(),
  lastRecovery: null as {
    id: number;
    coinsEarned: number;
    requestIds: readonly number[];
  } | null,
}));
const battleState = vi.hoisted(() => ({
  props: null as null | {
    coinsEarned: number;
    isSettling: boolean;
    settlementError: string | null;
    onExit: () => void;
    onRetry: () => void;
    onFinished: (outcome: {
      phase: "cleared";
      cakes: number;
      maxCakes: number;
      kills: number;
      waveIndex: number;
    }) => void;
  },
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock("./audio", () => audioMocks);
vi.mock("./screenSession", () => ({
  readScreenSession: () => null,
  writeScreenSession: vi.fn(),
}));
vi.mock("./useCampaignSave", () => ({
  useCampaignSave: () => ({
    save: {
      schemaVersion: 1,
      levelStars: {},
      bestWave: {},
      claimedClear: [],
      claimedThreeStars: [],
      updatedAt: 0,
    },
    status: "saved",
    isSignedIn: true,
    lastRecovery: campaignMocks.lastRecovery,
    recordResult: campaignMocks.recordResult,
  }),
}));
vi.mock("./useTowerRoster", () => ({
  useTowerRoster: () => ({
    available: [],
    availableIds: [],
    ownedCount: 0,
    isSignedIn: true,
  }),
}));
vi.mock("./useAudioSettings", () => ({
  useAudioSettings: () => ({
    settings: { music: 0.4, sfx: 0.7, muted: false },
    setMuted: vi.fn(),
    setMusicVolume: vi.fn(),
    setSfxVolume: vi.fn(),
  }),
}));
vi.mock("./ui/TitleScreen", () => ({
  TitleScreen: ({ onStart }: { onStart: (levelId: string) => void }) => (
    <button type="button" onClick={() => onStart("kitchen-cross")}>選擇關卡</button>
  ),
}));
vi.mock("./ui/SquadSelect", () => ({
  SquadSelect: ({ onStart }: { onStart: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onStart([])}>開始戰鬥</button>
  ),
}));
vi.mock("./ui/BattleScreen", () => ({
  BattleScreen: (props: NonNullable<typeof battleState.props>) => {
    battleState.props = props;
    return (
      <div>
        <span data-testid="coins">{props.coinsEarned}</span>
        <span data-testid="settling">{String(props.isSettling)}</span>
        {props.settlementError && <span>{props.settlementError}</span>}
        <button
          type="button"
          disabled={props.isSettling}
          onClick={props.onRetry}
        >
          重試
        </button>
        <button
          type="button"
          disabled={props.isSettling}
          onClick={props.onExit}
        >
          離開
        </button>
        <button
          type="button"
          onClick={() => props.onFinished({
            phase: "cleared",
            cakes: 10,
            maxCakes: 10,
            kills: 5,
            waveIndex: 0,
          })}
        >
          完成
        </button>
      </div>
    );
  },
}));

import SweetheartDefenders from "./SweetheartDefenders";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  campaignMocks.recordResult.mockResolvedValue({
    coinsEarned: 0,
    deferred: false,
  });
  campaignMocks.lastRecovery = null;
  battleState.props = null;
  authState.user = { uid: "uid-a" };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("menu music lifecycle", () => {
  it("stops menu music when the standalone game unmounts", () => {
    act(() => root.render(<SweetheartDefenders />));
    expect(audioMocks.playMusic).toHaveBeenCalledWith("menu");

    act(() => root.render(null));

    expect(audioMocks.stopMusic).toHaveBeenCalledTimes(1);
  });

  it("tears down the old account session before starting the new one", () => {
    act(() => root.render(<SweetheartDefenders />));
    authState.user = { uid: "uid-b" };
    act(() => root.render(<SweetheartDefenders />));

    expect(audioMocks.stopMusic).toHaveBeenCalledTimes(1);
    expect(audioMocks.playMusic).toHaveBeenCalledTimes(2);
  });
});

describe("battle settlement lifecycle", () => {
  function click(label: string) {
    const button = [...host.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === label,
    );
    if (!button) throw new Error(`Missing ${label}`);
    act(() => button.click());
  }

  it("blocks retry and exit until settlement finishes, then shows the reward", async () => {
    let resolveSettlement!: (result: {
      coinsEarned: number;
      deferred: boolean;
    }) => void;
    campaignMocks.recordResult.mockReturnValueOnce(new Promise((resolve) => {
      resolveSettlement = resolve;
    }));
    act(() => root.render(<SweetheartDefenders />));
    click("選擇關卡");
    click("開始戰鬥");
    click("完成");

    expect(battleState.props?.isSettling).toBe(true);
    expect(host.querySelector<HTMLButtonElement>("button:nth-of-type(1)")?.disabled)
      .toBe(true);

    // Call the captured handlers directly as a defense-in-depth check. If
    // either one changes the run, the late reward below will be discarded.
    act(() => {
      battleState.props?.onRetry();
      battleState.props?.onExit();
    });
    expect(host.textContent).toContain("完成");

    await act(async () => {
      resolveSettlement({ coinsEarned: 25, deferred: false });
      await Promise.resolve();
    });

    expect(battleState.props?.isSettling).toBe(false);
    expect(host.querySelector('[data-testid="coins"]')?.textContent).toBe("25");
    click("離開");
    expect(host.textContent).toContain("選擇關卡");
  });

  it("unlocks with a clear deferred message when cloud settlement is offline", async () => {
    campaignMocks.recordResult.mockResolvedValueOnce({
      coinsEarned: 0,
      deferred: true,
      recoveryRequestId: 7,
    });
    act(() => root.render(<SweetheartDefenders />));
    click("選擇關卡");
    click("開始戰鬥");
    await act(async () => {
      const finish = [...host.querySelectorAll("button")].find(
        (candidate) => candidate.textContent === "完成",
      );
      finish?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(battleState.props?.isSettling).toBe(false);
    expect(host.textContent).toContain("獎勵將在恢復連線後同步");
    const retry = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "重試");
    const exit = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "離開");
    expect(retry?.disabled).toBe(false);
    expect(exit?.disabled).toBe(false);

    campaignMocks.lastRecovery = {
      id: 1,
      coinsEarned: 999,
      requestIds: [99],
    };
    await act(async () => {
      root.render(<SweetheartDefenders />);
      await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="coins"]')?.textContent).toBe("0");
    expect(host.textContent).toContain("獎勵將在恢復連線後同步");

    campaignMocks.lastRecovery = {
      id: 2,
      coinsEarned: 25,
      requestIds: [7],
    };
    await act(async () => {
      root.render(<SweetheartDefenders />);
      await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="coins"]')?.textContent).toBe("25");
    expect(host.textContent).toContain("獎勵同步完成");
  });
});
