import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/shared/StatCard";
import { Star } from "lucide-react";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total Tasks" value={42} />);
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    const { container } = render(<StatCard label="Stars" value={5} icon={Star} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders trend text when provided", () => {
    render(<StatCard label="Tasks" value={10} trend="+5 from last week" />);
    expect(screen.getByText("+5 from last week")).toBeInTheDocument();
  });

  it("omits trend when not provided", () => {
    const { container } = render(<StatCard label="Tasks" value={10} />);
    // Should only have label and value divs
    const texts = container.querySelectorAll(".text-xs");
    expect(texts).toHaveLength(1); // just the label
  });
});
