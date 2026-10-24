import { useMemo } from "react";
import type { NetworkNode } from "@/data/types";
import type { CatchmentModel } from "./catchment/catchmentModel";
import { createFacadeTexture } from "./catchment/catchmentTextures";
import { buildNeighbourhoodPlan } from "./neighbourhoodPlan";
import type { NodeLayout } from "./types";
import { NETWORK } from "./visualConfig";
import { BuildingMesh } from "./urban/BuildingMesh";
import { RoadMesh } from "./urban/RoadMesh";
import { TreeMass } from "./urban/TreeMass";

type Props = {
  positions: NodeLayout;
  nodes: NetworkNode[];
  model: CatchmentModel;
  blueprint: boolean;
  subdue?: boolean;
};

export function UrbanContext({ positions, nodes, model, blueprint, subdue = false }: Props) {
  const plan = useMemo(() => buildNeighbourhoodPlan(model, positions, nodes), [model, nodes, positions]);
  const facadeTexture = useMemo(() => createFacadeTexture(), []);
  return (
    <group renderOrder={NETWORK.presentation.urbanRenderOrder}>
      {plan.roads.map((road, i) => (
        <RoadMesh key={`road-${i}`} road={road} model={model} blueprint={blueprint} subdue={subdue} />
      ))}
      {plan.buildings.map((building, i) => (
        <BuildingMesh
          key={`b-${i}`}
          building={building}
          model={model}
          blueprint={blueprint}
          facadeTexture={facadeTexture}
          subdue={subdue}
        />
      ))}
      <group renderOrder={NETWORK.presentation.vegetationRenderOrder}>
        {plan.trees.map((tree, i) => (
          <TreeMass key={`t-${i}`} tree={tree} blueprint={blueprint} subdue={subdue} />
        ))}
      </group>
    </group>
  );
}
