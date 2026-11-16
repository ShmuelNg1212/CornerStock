import { groups, locationNames, worstGroups } from "../../fixtures";
import { States } from "./states";

export default function PreviewStates() {
  return <States groups={groups} worst={worstGroups} locationNames={locationNames} />;
}
