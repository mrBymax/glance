import { Picture } from '../components/Picture';
import { TEAM_COPY } from '../content/site';
import { TEAM } from '../content/team';

export function Team() {
  return (
    <section id="team" className="section" aria-labelledby="team-title">
      <div className="container">
        <div className="section-head">
          <h2 id="team-title" className="section-title">
            {TEAM_COPY.heading}
          </h2>
          <p className="lead">{TEAM_COPY.lead}</p>
        </div>
        <ul className="team">
          {TEAM.map((member) => (
            <li key={member.id} className="team__member">
              <Picture
                className="team__photo"
                name={`team-${member.id}`}
                widths={[320, 480, 640]}
                sizes="(min-width: 64rem) 17rem, (min-width: 37.5rem) 45vw, 90vw"
                width={640}
                height={800}
                alt=""
              />
              <h3 className="team__name">{member.name}</h3>
              {member.role ? <p className="team__role">{member.role}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
