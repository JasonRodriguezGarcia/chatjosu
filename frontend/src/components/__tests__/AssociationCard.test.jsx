import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AssociationCard from "../AssociationCard";

describe("AssociationCard", () => {
  it("renders useful contact and territorial information", () => {
    render(
      <AssociationCard
        association={{
          id: "213",
          name: "Servicios sociales y de dependencia",
          scope: "Provincial",
          municipality: "Miranda de Ebro",
          province: "Burgos",
          address: "C/ Condes de Montarco, 2",
          phone: "947 33 03 33",
          email: "info@example.org",
          website:
            "[https://www.fedispa.es/](https://www.fedispa.es/)",
        }}
      />,
    );

    expect(
      screen.getByText("Servicios sociales y de dependencia"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Miranda de Ebro · Burgos"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Ámbito provincial"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("C/ Condes de Montarco, 2"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("947 33 03 33"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("info@example.org"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Llamar a Servicios sociales y de dependencia",
      }),
    ).toHaveAttribute("href", "tel:947330333");

    expect(
      screen.getByRole("link", {
        name: "Enviar un email a Servicios sociales y de dependencia",
      }),
    ).toHaveAttribute("href", "mailto:info@example.org");

    expect(
      screen.getByRole("link", {
        name: "Abrir el sitio web de Servicios sociales y de dependencia",
      }),
    ).toHaveAttribute("href", "https://www.fedispa.es/");
  });

  it("does not render unavailable contact actions", () => {
    render(
      <AssociationCard
        association={{
          id: "1",
          name: "Recurso sin contacto",
          province: "Burgos",
        }}
      />,
    );

    expect(
      screen.queryByRole("link", {
        name: /Llamar a /i,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: /Enviar un email a /i,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: /Abrir el sitio web de /i,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Ver Recurso sin contacto en el mapa",
      }),
    ).toBeInTheDocument();
  });
  it("does not render a map action without territorial information", () => {
    render(
      <AssociationCard
        association={{
          id: "remote",
          name: "Recurso remoto",
        }}
      />,
    );

    expect(
      screen.queryByRole("link", {
        name: "Ver Recurso remoto en el mapa",
      }),
    ).not.toBeInTheDocument();
  });


  it("uses phone as the primary action when available", () => {
    render(
      <AssociationCard
        association={{
          id: "priority-phone",
          name: "Recurso con teléfono",
          province: "Burgos",
          phone: "947 00 00 00",
          email: "hola@example.org",
          website: "https://example.org",
        }}
      />,
    );

    const phone = screen.getByRole("link", {
      name: "Llamar a Recurso con teléfono",
    });
    const website = screen.getByRole("link", {
      name: "Abrir el sitio web de Recurso con teléfono",
    });

    expect(phone).toHaveClass("MuiButton-contained");
    expect(website).toHaveClass("MuiButton-outlined");
  });

  it("uses website as the primary action when phone is unavailable", () => {
    render(
      <AssociationCard
        association={{
          id: "priority-web",
          name: "Recurso web",
          province: "Burgos",
          email: "hola@example.org",
          website: "https://example.org",
        }}
      />,
    );

    const website = screen.getByRole("link", {
      name: "Abrir el sitio web de Recurso web",
    });
    const email = screen.getByRole("link", {
      name: "Enviar un email a Recurso web",
    });

    expect(website).toHaveClass("MuiButton-contained");
    expect(email).toHaveClass("MuiButton-outlined");
  });

  it("uses email as the primary action when phone and website are unavailable", () => {
    render(
      <AssociationCard
        association={{
          id: "priority-email",
          name: "Recurso por email",
          province: "Burgos",
          email: "hola@example.org",
        }}
      />,
    );

    const email = screen.getByRole("link", {
      name: "Enviar un email a Recurso por email",
    });
    const map = screen.getByRole("link", {
      name: "Ver Recurso por email en el mapa",
    });

    expect(email).toHaveClass("MuiButton-contained");
    expect(map).toHaveClass("MuiButton-outlined");
  });

  it("uses map as the primary action when it is the only available action", () => {
    render(
      <AssociationCard
        association={{
          id: "priority-map",
          name: "Recurso territorial",
          province: "Burgos",
        }}
      />,
    );

    const map = screen.getByRole("link", {
      name: "Ver Recurso territorial en el mapa",
    });

    expect(map).toHaveClass("MuiButton-contained");
  });

});
