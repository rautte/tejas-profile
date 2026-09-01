import {
  TRAFFIC_EVIDENCE,
  clearTrafficEvidence,
  readTrafficEvidence,
  recordTrustedTrafficInteraction,
} from "./trafficEvidence";


describe(
  "trafficEvidence",
  () => {
    beforeEach(
      () => {
        clearTrafficEvidence();
      }
    );


    test(
      "records only trusted coarse interaction evidence",
      () => {
        recordTrustedTrafficInteraction({
          sessionId:
            "session-a",

          kind:
            "pointer",

          event: {
            isTrusted:
              false,
          },
        });


        expect(
          readTrafficEvidence(
            "session-a"
          )
        ).toEqual([]);


        recordTrustedTrafficInteraction({
          sessionId:
            "session-a",

          kind:
            "pointer",

          event: {
            isTrusted:
              true,
          },
        });


        recordTrustedTrafficInteraction({
          sessionId:
            "session-a",

          kind:
            "keyboard",

          event: {
            isTrusted:
              true,
          },
        });


        expect(
          readTrafficEvidence(
            "session-a"
          )
        ).toEqual([
          TRAFFIC_EVIDENCE
            .TRUSTED_KEYBOARD_INPUT,

          TRAFFIC_EVIDENCE
            .TRUSTED_POINTER_INPUT,
        ]);
      }
    );


    test(
      "evidence resets when the logical session changes",
      () => {
        recordTrustedTrafficInteraction({
          sessionId:
            "session-a",

          kind:
            "touch",

          event: {
            isTrusted:
              true,
          },
        });


        expect(
          readTrafficEvidence(
            "session-a"
          )
        ).toContain(
          TRAFFIC_EVIDENCE
            .TRUSTED_TOUCH_INPUT
        );


        expect(
          readTrafficEvidence(
            "session-b"
          )
        ).not.toContain(
          TRAFFIC_EVIDENCE
            .TRUSTED_TOUCH_INPUT
        );
      }
    );


    test(
      "unknown interaction kinds cannot create arbitrary evidence",
      () => {
        recordTrustedTrafficInteraction({
          sessionId:
            "session-a",

          kind:
            "raw-user-agent",

          event: {
            isTrusted:
              true,
          },
        });


        expect(
          readTrafficEvidence(
            "session-a"
          )
        ).toEqual([]);
      }
    );
  }
);
