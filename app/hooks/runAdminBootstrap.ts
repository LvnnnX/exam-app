type RunAdminBootstrapArgs = {
  fetchAdminQuestions: () => Promise<void>;
  loadAllMapelsAdmin: () => Promise<void>;
  loadAllBabsAdmin: () => Promise<void>;
  loadAllSubBabsAdmin: () => Promise<void>;
  loadVisibilitySettings: () => Promise<void>;
};

export default async function runAdminBootstrap({
  fetchAdminQuestions,
  loadAllMapelsAdmin,
  loadAllBabsAdmin,
  loadAllSubBabsAdmin,
  loadVisibilitySettings,
}: RunAdminBootstrapArgs) {
  await fetchAdminQuestions();
  await loadAllMapelsAdmin();
  await loadAllBabsAdmin();
  await loadAllSubBabsAdmin();
  await loadVisibilitySettings();
}
