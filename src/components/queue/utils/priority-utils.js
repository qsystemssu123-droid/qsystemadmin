
// Get the selected service names for display.
export const getAppointmentServices = (item) => {
  const services = [];

  const addService = (value) => {
    if (typeof value === "string") {
      const normalized = value.trim();

      if (normalized) {
        services.push(normalized);
      }

      return;
    }

    if (value && typeof value === "object") {
      const serviceName =
        value.serviceName ||
        value.name ||
        value.label ||
        value.service ||
        value.title;

      if (
        typeof serviceName === "string" &&
        serviceName.trim()
      ) {
        services.push(serviceName.trim());
      }
    }
  };

  if (Array.isArray(item?.services)) {
    item.services.forEach(addService);
  }

  if (Array.isArray(item?.selectedServices)) {
    item.selectedServices.forEach(addService);
  }

  if (Array.isArray(item?.serviceNames)) {
    item.serviceNames.forEach(addService);
  }

  if (
    typeof item?.service === "string" &&
    item.service.trim()
  ) {
    item.service.split(",").forEach(addService);
  }

  if (
    typeof item?.serviceName === "string" &&
    item.serviceName.trim()
  ) {
    addService(item.serviceName);
  }

  return [...new Set(services)];
};

export const getServiceLabel = (item) => {
  const services = getAppointmentServices(item);

  return services.length
    ? services.join(", ")
    : item?.reason || "Appointment";
};
