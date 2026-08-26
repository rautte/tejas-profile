// src/components/admin/CurrentRuntimeCompositionCard.test.js

import {
  render,
  screen,
} from "@testing-library/react";

import CurrentRuntimeCompositionCard from "./CurrentRuntimeCompositionCard";


describe(
  "CurrentRuntimeCompositionCard",
  () => {
    test(
      "shows the complete formal active composition",
      () => {
        render(
          <CurrentRuntimeCompositionCard
            activeProfileVariantId="prv_active"
            activePlatformReleaseId="plr_active"
            activeDeploymentConfigurationId="cfg_active"
          />
        );


        expect(
          screen.getByText(
            "Formal composition active"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByTestId(
            "runtime-profile-variant-id"
          )
        ).toHaveTextContent(
          "prv_active"
        );


        expect(
          screen.getByTestId(
            "runtime-platform-release-id"
          )
        ).toHaveTextContent(
          "plr_active"
        );


        expect(
          screen.getByTestId(
            "runtime-deployment-configuration-id"
          )
        ).toHaveTextContent(
          "cfg_active"
        );
      }
    );


    test(
      "shows the truthful Profile-only migration state",
      () => {
        render(
          <CurrentRuntimeCompositionCard
            activeProfileVariantId="prv_active"
          />
        );


        expect(
          screen.getByText(
            "Profile active · Platform identity not established"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "shows no formal composition when runtime is repository-backed",
      () => {
        render(
          <CurrentRuntimeCompositionCard />
        );


        expect(
          screen.getByText(
            "No formal active composition"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "fails visibly when Platform identity is only partially present",
      () => {
        render(
          <CurrentRuntimeCompositionCard
            activeProfileVariantId="prv_active"
            activePlatformReleaseId="plr_partial"
          />
        );


        expect(
          screen.getByText(
            "Inconsistent runtime identity"
          )
        ).toBeInTheDocument();
      }
    );
  }
);