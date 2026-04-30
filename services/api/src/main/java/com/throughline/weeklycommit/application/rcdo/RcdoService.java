package com.throughline.weeklycommit.application.rcdo;

import com.throughline.weeklycommit.domain.DefiningObjective;
import com.throughline.weeklycommit.domain.Outcome;
import com.throughline.weeklycommit.domain.RallyCry;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.exception.LifecycleConflictException;
import com.throughline.weeklycommit.domain.repo.DefiningObjectiveRepository;
import com.throughline.weeklycommit.domain.repo.OutcomeRepository;
import com.throughline.weeklycommit.domain.repo.RallyCryRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.web.dto.RcdoDtos;
import com.throughline.weeklycommit.web.dto.RcdoDtos.CreateDefiningObjectiveRequest;
import com.throughline.weeklycommit.web.dto.RcdoDtos.CreateOutcomeRequest;
import com.throughline.weeklycommit.web.dto.RcdoDtos.CreateRallyCryRequest;
import com.throughline.weeklycommit.web.dto.RcdoDtos.CreateSupportingOutcomeRequest;
import com.throughline.weeklycommit.web.dto.RcdoDtos.UpdateRallyCryRequest;
import com.throughline.weeklycommit.web.error.NotFoundException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RcdoService {

  private final RallyCryRepository rallyCryRepo;
  private final DefiningObjectiveRepository doRepo;
  private final OutcomeRepository outcomeRepo;
  private final SupportingOutcomeRepository soRepo;

  public RcdoService(
      RallyCryRepository rallyCryRepo,
      DefiningObjectiveRepository doRepo,
      OutcomeRepository outcomeRepo,
      SupportingOutcomeRepository soRepo) {
    this.rallyCryRepo = rallyCryRepo;
    this.doRepo = doRepo;
    this.outcomeRepo = outcomeRepo;
    this.soRepo = soRepo;
  }

  @Transactional(readOnly = true)
  public RcdoDtos.TreeDto getTree(String orgId) {
    List<RallyCry> rcs =
        rallyCryRepo.findAllByOrgIdAndArchivedAtIsNullOrderByDisplayOrderAsc(orgId);
    if (rcs.isEmpty()) return new RcdoDtos.TreeDto(List.of());
    List<String> rcIds = rcs.stream().map(RallyCry::getId).toList();
    Map<String, List<DefiningObjective>> dosByRc =
        doRepo.findAllByRallyCryIdInAndArchivedAtIsNullOrderByDisplayOrderAsc(rcIds).stream()
            .collect(Collectors.groupingBy(DefiningObjective::getRallyCryId));

    List<String> doIds =
        dosByRc.values().stream().flatMap(List::stream).map(DefiningObjective::getId).toList();
    Map<String, List<Outcome>> outcomesByDo =
        doIds.isEmpty()
            ? Map.of()
            : outcomeRepo
                .findAllByDefiningObjectiveIdInAndArchivedAtIsNullOrderByDisplayOrderAsc(doIds)
                .stream()
                .collect(Collectors.groupingBy(Outcome::getDefiningObjectiveId));

    List<String> outcomeIds =
        outcomesByDo.values().stream().flatMap(List::stream).map(Outcome::getId).toList();
    Map<String, List<SupportingOutcome>> sosByOutcome =
        outcomeIds.isEmpty()
            ? Map.of()
            : soRepo
                .findAllByOutcomeIdInAndArchivedAtIsNullOrderByDisplayOrderAsc(outcomeIds)
                .stream()
                .collect(Collectors.groupingBy(SupportingOutcome::getOutcomeId));

    List<RcdoDtos.RallyCryDto> rcDtos =
        rcs.stream()
            .map(
                rc -> {
                  List<DefiningObjective> dos = dosByRc.getOrDefault(rc.getId(), List.of());
                  List<RcdoDtos.DefiningObjectiveDto> doDtos =
                      dos.stream()
                          .map(
                              defo -> {
                                List<Outcome> os =
                                    outcomesByDo.getOrDefault(defo.getId(), List.of());
                                List<RcdoDtos.OutcomeDto> oDtos =
                                    os.stream()
                                        .map(
                                            o -> {
                                              List<SupportingOutcome> sos =
                                                  sosByOutcome.getOrDefault(o.getId(), List.of());
                                              List<RcdoDtos.SupportingOutcomeDto> soDtos =
                                                  sos.stream().map(this::toSoDto).toList();
                                              return new RcdoDtos.OutcomeDto(
                                                  o.getId(),
                                                  o.getDefiningObjectiveId(),
                                                  o.getTitle(),
                                                  o.getDescription(),
                                                  o.getMetricStatement(),
                                                  o.getDisplayOrder(),
                                                  o.getArchivedAt(),
                                                  soDtos);
                                            })
                                        .toList();
                                return new RcdoDtos.DefiningObjectiveDto(
                                    defo.getId(),
                                    defo.getRallyCryId(),
                                    defo.getTitle(),
                                    defo.getDescription(),
                                    defo.getDisplayOrder(),
                                    defo.getArchivedAt(),
                                    oDtos);
                              })
                          .toList();
                  return new RcdoDtos.RallyCryDto(
                      rc.getId(),
                      rc.getTitle(),
                      rc.getDescription(),
                      rc.getDisplayOrder(),
                      rc.getArchivedAt(),
                      doDtos);
                })
            .toList();
    return new RcdoDtos.TreeDto(rcDtos);
  }

  private RcdoDtos.SupportingOutcomeDto toSoDto(SupportingOutcome so) {
    return new RcdoDtos.SupportingOutcomeDto(
        so.getId(),
        so.getOutcomeId(),
        so.getTitle(),
        so.getDescription(),
        so.getDisplayOrder(),
        so.getArchivedAt());
  }

  @Transactional
  public RcdoDtos.RallyCryDto createRallyCry(String orgId, CreateRallyCryRequest req) {
    rallyCryRepo
        .findByOrgIdAndTitleAndArchivedAtIsNull(orgId, req.title())
        .ifPresent(
            (rc) -> {
              throw new LifecycleConflictException("Rally Cry with title already exists");
            });
    RallyCry rc = new RallyCry(orgId, req.title());
    rc.setDescription(req.description());
    rc.setDisplayOrder(req.displayOrder() == null ? 0 : req.displayOrder());
    rallyCryRepo.save(rc);
    return new RcdoDtos.RallyCryDto(
        rc.getId(),
        rc.getTitle(),
        rc.getDescription(),
        rc.getDisplayOrder(),
        rc.getArchivedAt(),
        List.of());
  }

  @Transactional
  public RcdoDtos.RallyCryDto updateRallyCry(String id, UpdateRallyCryRequest req) {
    RallyCry rc =
        rallyCryRepo.findById(id).orElseThrow(() -> new NotFoundException("RallyCry", id));
    rc.setTitle(req.title());
    rc.setDescription(req.description());
    if (req.displayOrder() != null) rc.setDisplayOrder(req.displayOrder());
    rallyCryRepo.save(rc);
    return new RcdoDtos.RallyCryDto(
        rc.getId(),
        rc.getTitle(),
        rc.getDescription(),
        rc.getDisplayOrder(),
        rc.getArchivedAt(),
        List.of());
  }

  @Transactional
  public void archiveRallyCry(String id) {
    RallyCry rc =
        rallyCryRepo.findById(id).orElseThrow(() -> new NotFoundException("RallyCry", id));
    long activeChildren = doRepo.countByRallyCryIdAndArchivedAtIsNull(rc.getId());
    if (activeChildren > 0) {
      throw new LifecycleConflictException(
          "Rally Cry has active Defining Objectives — archive children first");
    }
    rc.archive();
    rallyCryRepo.save(rc);
  }

  @Transactional
  public RcdoDtos.DefiningObjectiveDto createDefiningObjective(CreateDefiningObjectiveRequest req) {
    RallyCry rc =
        rallyCryRepo
            .findById(req.rallyCryId())
            .orElseThrow(() -> new NotFoundException("RallyCry", req.rallyCryId()));
    if (rc.isArchived()) {
      throw new LifecycleConflictException("Cannot create DO under archived Rally Cry");
    }
    DefiningObjective defo = new DefiningObjective(rc.getId(), req.title());
    defo.setDescription(req.description());
    defo.setDisplayOrder(req.displayOrder() == null ? 0 : req.displayOrder());
    doRepo.save(defo);
    return new RcdoDtos.DefiningObjectiveDto(
        defo.getId(),
        defo.getRallyCryId(),
        defo.getTitle(),
        defo.getDescription(),
        defo.getDisplayOrder(),
        defo.getArchivedAt(),
        List.of());
  }

  @Transactional
  public RcdoDtos.OutcomeDto createOutcome(CreateOutcomeRequest req) {
    DefiningObjective defo =
        doRepo
            .findById(req.definingObjectiveId())
            .orElseThrow(
                () -> new NotFoundException("DefiningObjective", req.definingObjectiveId()));
    if (defo.isArchived()) {
      throw new LifecycleConflictException("Cannot create Outcome under archived DO");
    }
    Outcome o = new Outcome(defo.getId(), req.title());
    o.setDescription(req.description());
    o.setMetricStatement(req.metricStatement());
    o.setDisplayOrder(req.displayOrder() == null ? 0 : req.displayOrder());
    outcomeRepo.save(o);
    return new RcdoDtos.OutcomeDto(
        o.getId(),
        o.getDefiningObjectiveId(),
        o.getTitle(),
        o.getDescription(),
        o.getMetricStatement(),
        o.getDisplayOrder(),
        o.getArchivedAt(),
        List.of());
  }

  @Transactional
  public RcdoDtos.SupportingOutcomeDto createSupportingOutcome(CreateSupportingOutcomeRequest req) {
    Outcome o =
        outcomeRepo
            .findById(req.outcomeId())
            .orElseThrow(() -> new NotFoundException("Outcome", req.outcomeId()));
    if (o.isArchived()) {
      throw new LifecycleConflictException("Cannot create SO under archived Outcome");
    }
    SupportingOutcome so = new SupportingOutcome(o.getId(), req.title());
    so.setDescription(req.description());
    so.setDisplayOrder(req.displayOrder() == null ? 0 : req.displayOrder());
    soRepo.save(so);
    return toSoDto(so);
  }

  @Transactional
  public void archiveSupportingOutcome(String id) {
    SupportingOutcome so =
        soRepo.findById(id).orElseThrow(() -> new NotFoundException("SupportingOutcome", id));
    so.archive();
    soRepo.save(so);
  }
}
