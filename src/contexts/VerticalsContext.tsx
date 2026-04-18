import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { VerticalConfig } from "@/lib/icp-config";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VerticalsContextType {
  verticals: VerticalConfig[];
  loading: boolean;
  addVertical: (draft: any) => Promise<VerticalConfig | null>;
  updateVertical: (id: string, draft: any) => Promise<boolean>;
  deleteVertical: (id: string) => Promise<boolean>;
  getVerticalByName: (name: string) => VerticalConfig | undefined;
  refreshVerticals: () => Promise<void>;
}

const VerticalsContext = createContext<VerticalsContextType | null>(null);

function dbToVertical(row: any): VerticalConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    savings: row.savings || "",
    isDefault: row.is_default || false,
    icon: row.icon,
    jobTitlesToSearch: row.job_titles_to_search || [],
    buyerPersonas: row.buyer_personas || [],
    usCostRange: row.us_cost_range || "",
    obCostRange: row.ob_cost_range || "",
    techStack: row.tech_stack || [],
    sellingPoints: row.selling_points || [],
    defaultMinEmployees: row.default_min_employees || "51",
    defaultMaxEmployees: row.default_max_employees || "5001",
    defaultMinRevenue: row.default_min_revenue || "10000000",
    defaultMaxRevenue: row.default_max_revenue || "1000000000",
    defaultLocations: row.default_locations || ["United States"],
    // Legacy fields
    apollo_job_titles: row.job_titles_to_search || [],
    buyer_titles: row.buyer_personas || [],
    buyer_seniorities: ["c_suite", "vp", "director"],
    roles_to_staff: row.job_titles_to_search || [],
    us_cost: row.us_cost_range || "",
    ob_cost: row.ob_cost_range || "",
    pitch: row.description || "",
    tools_to_reference: row.tech_stack || [],
    exclude_industries: ["staffing", "recruiting"],
    company_size: ["51,200", "201,500", "501,1000"],
    min_revenue: 5000000,
    min_jobs: 3,
  };
}

export function VerticalsProvider({ children }: { children: React.ReactNode }) {
  const [verticals, setVerticals] = useState<VerticalConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVerticals = useCallback(async () => {
    const { data, error } = await supabase
      .from("verticals")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load verticals:", error);
      toast.error("Failed to load verticals");
    } else {
      setVerticals((data || []).map(dbToVertical));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVerticals();
  }, [loadVerticals]);

  const addVertical = useCallback(async (draft: any): Promise<VerticalConfig | null> => {
    const { data, error } = await supabase
      .from("verticals")
      .insert({
        name: draft.name,
        description: draft.description,
        savings: draft.savings,
        is_default: false,
        job_titles_to_search: draft.jobTitlesToSearch,
        buyer_personas: draft.buyerPersonas,
        us_cost_range: draft.usCostRange,
        ob_cost_range: draft.obCostRange,
        tech_stack: draft.techStack,
        selling_points: draft.sellingPoints,
        default_min_employees: draft.defaultMinEmployees || "51",
        default_max_employees: draft.defaultMaxEmployees || "5001",
        default_min_revenue: draft.defaultMinRevenue || "10000000",
        default_max_revenue: draft.defaultMaxRevenue || "1000000000",
        default_locations: draft.defaultLocations || ["United States"],
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to save vertical: " + error.message);
      return null;
    }

    const v = dbToVertical(data);
    setVerticals((prev) => [...prev, v]);
    toast.success(`Vertical "${draft.name}" saved!`);
    return v;
  }, []);

  const updateVertical = useCallback(async (id: string, draft: any): Promise<boolean> => {
    const { error } = await supabase
      .from("verticals")
      .update({
        name: draft.name,
        description: draft.description,
        savings: draft.savings,
        job_titles_to_search: draft.jobTitlesToSearch,
        buyer_personas: draft.buyerPersonas,
        us_cost_range: draft.usCostRange,
        ob_cost_range: draft.obCostRange,
        tech_stack: draft.techStack,
        selling_points: draft.sellingPoints,
        default_min_employees: draft.defaultMinEmployees || "51",
        default_max_employees: draft.defaultMaxEmployees || "5001",
        default_min_revenue: draft.defaultMinRevenue || "10000000",
        default_max_revenue: draft.defaultMaxRevenue || "1000000000",
        default_locations: draft.defaultLocations || ["United States"],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update vertical");
      return false;
    }

    setVerticals((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              name: draft.name,
              description: draft.description,
              savings: draft.savings,
              jobTitlesToSearch: draft.jobTitlesToSearch,
              buyerPersonas: draft.buyerPersonas,
              usCostRange: draft.usCostRange,
              obCostRange: draft.obCostRange,
              techStack: draft.techStack,
              sellingPoints: draft.sellingPoints,
              apollo_job_titles: draft.jobTitlesToSearch,
              buyer_titles: draft.buyerPersonas,
              us_cost: draft.usCostRange,
              ob_cost: draft.obCostRange,
              pitch: draft.description,
              tools_to_reference: draft.techStack,
            }
          : v
      )
    );
    toast.success("Vertical updated!");
    return true;
  }, []);

  const deleteVertical = useCallback(async (id: string): Promise<boolean> => {
    const target = verticals.find((v) => v.id === id);
    if (!target || target.isDefault) return false;

    const { error } = await supabase
      .from("verticals")
      .delete()
      .eq("id", id)
      .eq("is_default", false);

    if (error) {
      toast.error("Failed to delete vertical");
      return false;
    }

    setVerticals((prev) => prev.filter((v) => v.id !== id));
    toast.success("Vertical deleted");
    return true;
  }, [verticals]);

  const getVerticalByName = useCallback(
    (name: string) => verticals.find((v) => v.name === name),
    [verticals]
  );

  return (
    <VerticalsContext.Provider
      value={{ verticals, loading, addVertical, updateVertical, deleteVertical, getVerticalByName, refreshVerticals: loadVerticals }}
    >
      {children}
    </VerticalsContext.Provider>
  );
}

export function useVerticals() {
  const ctx = useContext(VerticalsContext);
  if (!ctx) throw new Error("useVerticals must be used within VerticalsProvider");
  return ctx;
}
