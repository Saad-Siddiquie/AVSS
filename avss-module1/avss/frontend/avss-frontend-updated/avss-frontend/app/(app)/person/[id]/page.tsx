import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PersonDetailView from "@/components/views/PersonDetailView";
import { persons, getPerson, sightingsFor } from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return persons.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = getPerson(id);
  return { title: p ? `Person ID ${p.trackId}` : "Person" };
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const person = getPerson(id);
  if (!person) notFound();

  // Replace with: GET /api/persons/{id} and GET /api/persons/{id}/sightings
  return (
    <Suspense>
      <PersonDetailView person={person} path={sightingsFor(person.id)} />
    </Suspense>
  );
}
