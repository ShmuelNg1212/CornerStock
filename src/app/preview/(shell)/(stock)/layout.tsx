import { StockFrame } from "@/components/stock/stock-frame";
import { StockList } from "@/components/stock/stock-list";
import { groups, locationNames, locations, serialMatches } from "../../fixtures";

export default function PreviewStock({ children }: { children: React.ReactNode }) {
  return (
    <StockFrame
      base="/preview"
      list={<StockList base="/preview" groups={groups} place={locations[0].name} today={{ received: 3, sold: 1 }} locationNames={locationNames} fixtureSerials={serialMatches} />}
    >
      {children}
    </StockFrame>
  );
}
