import type { Slide, SlideProps } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import { useBuildMotion } from "./bevisMotion";
import "./bevis.css";

/*
 * A fork on the line map: one line in, two out. The two branches have the
 * same form and weight: placement, not ranking. External tools are the
 * kind of tool, not a product: Nav has used several tools from vendors.
 * Purple is outside Nav, blue is Lumi, and the line in is the team's,
 * green: on click 1 it is drawn up to the fork, since the team chooses.
 * Lumi's limit is set as strongly as the facts, since it is what decides
 * for the open pages on nav.no. All of it ends left of x 1520 below y 800,
 * clear of the Teams corner.
 */
const FORK = { x: 560, y: 530 } as const;
const TEAM_X = 196;
const BEND = 150;
const STATION_X = 800;
const LABEL_X = STATION_X + 64;
const RING = 32;

const BRANCHES = [
  {
    tone: "ute",
    name: "Eksterne verktøy",
    how: "Uten utvikler",
    where: "også åpne sider",
    y: FORK.y - BEND,
  },
  {
    tone: "lumi",
    name: "Lumi",
    how: "I appens kode",
    where: "krever innlogging",
    y: FORK.y + BEND,
    limit: true,
  },
] as const;

function UlikeBehov({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div className="slide verktoy" data-motion={motion ? "" : undefined}>
      <h2 className="verktoy__title">
        Eksterne verktøy og Lumi passer til ulike behov
      </h2>
      <LineMap label="En linje som deler seg i to. Den ene grenen, lilla, går til eksterne verktøy: uten utvikler, også åpne sider. Den andre, blå, går til Lumi: i appens kode, krever innlogging. Linjen inn til delingen er teamets, grønn: teamet velger.">
        {/* The line in: dim until the team takes it. */}
        <Line
          points={[
            [TEAM_X, FORK.y],
            [FORK.x, FORK.y],
          ]}
          dim
        />
        {BRANCHES.map((branch) => (
          <g
            key={branch.name}
            className={`verktoy__branch verktoy__branch--${branch.tone}`}
          >
            <Line
              points={[
                [FORK.x, FORK.y],
                [FORK.x + BEND, branch.y],
                [STATION_X, branch.y],
              ]}
              radius={40}
            />
            <Station x={STATION_X} y={branch.y} r={RING} />
            <MapText
              x={LABEL_X}
              y={branch.y}
              size={96}
              weight={800}
              className="verktoy__name"
            >
              {branch.name}
            </MapText>
            <MapText x={LABEL_X} y={branch.y + 88} size={52} weight={700}>
              {branch.how}
            </MapText>
            <MapText
              x={LABEL_X}
              y={branch.y + 146}
              size={44}
              weight={"limit" in branch ? 800 : 500}
              muted={!("limit" in branch)}
            >
              {branch.where}
            </MapText>
          </g>
        ))}
        <g className="verktoy__team" data-from={1}>
          <Line
            points={[
              [TEAM_X, FORK.y],
              [FORK.x, FORK.y],
            ]}
            draw
            from={1}
            className="verktoy__trunk"
          />
          <Station x={TEAM_X} y={FORK.y} r={RING + 8} />
          <MapText
            x={TEAM_X}
            y={FORK.y + 96}
            anchor="middle"
            size={44}
            weight={800}
          >
            Teamet
          </MapText>
        </g>
      </LineMap>
      <p className="verktoy__choice" data-from={1}>
        Teamet velger hvem som lager surveyen,
        <br />
        og om svaret skal bli i Nav.
      </p>
    </div>
  );
}

export const ulikeBehov: Slide = {
  id: "ulike-behov",
  title: "Eksterne verktøy og Lumi passer til ulike behov",
  rooms: ["frontend", "produktledere"],
  steps: 1,
  Component: UlikeBehov,
};
