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

});
